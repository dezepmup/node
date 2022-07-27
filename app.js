const express = require('express');
const handlebars = require('express-handlebars');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passportSocket = require('passport.socketio');
const async = require('async');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const path = require('path');
const mongoose = require('mongoose');
const http = require('http');
const socket = require('socket.io');
const MongoStore = require('connect-mongo')(session);
const SteamCommunity = require('steamcommunity');
const SteamTotp = require('steam-totp');
const Environment = require('./data/constants/Environment');
const config = Environment.getEnvironments();
const axios = require('axios');
const crypto = require('crypto');
const bodyParser = require('body-parser');


const Inventory = require('./models/inventory');
const Item = require('./models/item');
const User = require('./models/user');
const Price = require('./models/price');


const SteamBot = require('./bots');
const priceUpdater = require('./helpers/priceUpdater');

const sortKeys = x => {
  if (typeof x !== 'object' || !x) return x;
  if (Array.isArray(x)) return x.map(sortKeys);
  return Object.keys(x)
      .sort()
      .reduce((o, k) => ({ ...o, [k]: sortKeys(x[k]) }), {});
}

const app = express();
const server = http.Server(app);
const io = socket(server);
const hbs = handlebars.create({
  defaultLayout: 'main',
  extname: 'hbs'
});
const community = new SteamCommunity();
const sessionStore = new MongoStore({
  mongooseConnection: mongoose.connection
});
const bot = new SteamBot({
  accountName: config.steamConfiguration.username,
  password: config.steamConfiguration.password,
  twoFactorCode: SteamTotp.generateAuthCode(config.steamConfiguration.sharedSecret)
});

mongoose.connect(config.dbMasterDsn);
priceUpdater(6 * 60 * 60 * 1000);

passport.serializeUser((user, done) => {
  User.updateOne(
    {
      steamid: user.id,
      credits: 1000
    },
    {
      $set: user._json
    },
    { upsert: true },
    err => {
      done(err, user._json);
    }
  );
});

passport.deserializeUser((obj, done) => {
  User.findOne(
    {
      steamid: obj.steamid
    },
    (err, user) => {
      done(err, user);
    }
  );
});




passport.use(
  new SteamStrategy(
    {
      returnURL: `${config.serverUrl}auth/steam/return`,
      realm: config.serverUrl,
      apiKey: config.steamConfiguration.apiKey
    },
    (identifier, profile, done) => {
      return done(null, profile);
    }
  )
);

io.use(
  passportSocket.authorize({
    cookieParser: cookieParser,
    key: 'U_SESSION',
    secret: config.steamConfiguration.secretString,
    store: sessionStore
  })
);

io.on('connection', socket => {
  socket.on('deposit', data => {
    const user = socket.request.user;
    console.log(`${user.personaname} is depositting ${data.assetid}`);

    bot.sendDepositTrade(
      user.steamid,
      data.assetid,
      (err, success, tradeOffer) => {
        // TODO: Handle these events on the website
        if (err && !success) {
          socket.emit('failure', {
            message: 'We could not process your request at this time.'
          });
        } else {
          socket.emit('success', { tradeOffer });
        }
      }
    );
  });

  socket.on('withdraw', data => {
    const user = socket.request.user;
    console.log(`${user.personaname} is withdrawing ${data.assetid}`);

    bot.sendWithdrawTrade(
      user.steamid,
      user.credits,
      data.assetid,
      data.price,
      (err, success, tradeOffer) => {
        // TODO: Handle these events on the website
        if (err && !success) {
          socket.emit('failure', {
            message: 'We could not process your request at this time.'
          });
        } else {
          socket.emit('success', { tradeOffer });
        }
      }
    );
  });
});

app.engine('hbs', hbs.engine);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(
  session({
    secret: config.steamConfiguration.secretString,
    name: 'U_SESSION',
    resave: true,
    saveUninitialized: true,
    store: sessionStore
  })
);

app.use(passport.initialize());
app.use(passport.session());
app.use(express.static('public'));
app.use(cookieParser());
app.use(bodyParser.json())

app.post('/payment_intent', (req, res) => {
  
  if (!req.user) {
    return res.redirect('/auth/steam');
  }
  const {
    invoice = 0,
    currency = 'USD',
    amount = 0,
    language = 'en',
  } = req.body
  const { password, username, host, salt } = config.start2Pay

  let payload = {
    invoice,
    currency,
    user_id: req.user.steamid,
    display_options: { language }
  }
  
  if(amount > 0) {
    payload.amount = amount
  }
  
  payload = sortKeys(payload)
  payload.signature = crypto
    .createHash('sha256')
    .update(`${JSON.stringify(payload)}${salt}`)
    .digest('hex')

  const headers = {
    Authorization: crypto.createHash('md5').update(`${username}:${password}`)
  }
  const { data } = await axios.post(`${host}/hpp/deposit`, payload, { headers: headers });

  if (data && data.status && data.status === 'success' && 'payment_url' in data) {
    res.send(200).json({ status: 'success', url: data.payment_url });
  } else {
    res.send(500).json({
      status: 'fail',
      error_code: data.error_code,
      error_message: data.error_message,
      error_message_extra: data.error_message_extra
    });
  }
});

app.get('/', (req, res) => {
  Item.findOne(
    {
      steamid: config.steamConfiguration.botSteamId
    },
    (err, inv) => {
      if (inv && Date.now() - inv.updated > 6 * 60 * 60 * 1000) {
        res.render('index', {
          user: req.user,
          items: inv.items,
          title: 'Home page'
        });
      } else {
        community.getUserInventoryContents(
          config.steamConfiguration.botSteamId,
          730,
          2,
          true,
          (err, inv) => {
            if (err) {
              console.log(err);
            } else {
              async.map(
                inv,
                (item, done) => {
                  Price.findOne(
                    {
                      market_hash_name: item.market_hash_name
                    },
                    (err, doc) => {
                      item.price = doc ? doc.price : 0;
                      item.image = `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`
                      done(null, item);
                    }
                  );
                },
                (err, results) => {
                  Item.updateMany(
                    {
                      steamid: config.steamConfiguration.botSteamId
                    },
                    {
                      $set: {
                        updated: Date.now(),
                        items: results
                      }
                    },
                    { upsert: true },
                    err => {
                      if (err) {
                        console.log(err);
                      }
                    }
                  );
                  res.render('index', {
                    user: req.user,
                    items: results,
                    title: 'Home page'
                  });
                }
              );
            }
          }
        );
      }
    }
  ).lean();
});

app.get('/pay', (req, res) => {
  if (req.user) {
    res.render('pay', {
      user: req.user,
      title: 'Payment page'
    });
  } else {
    res.redirect('/auth/steam');
  }
});

app.get('/profile', (req, res) => {
  if (req.user) {
    res.render('profile', {
      user: req.user,
      title: 'Profile page'
    });
  } else {
    res.redirect('/auth/steam');
  }
});



app.get('/withdraw', (req, res) => {
  if (req.user) {
    res.render('withdraw', {
      user: req.user,
      title: 'Withdraw'
    });
  } else {
    res.redirect('/auth/steam');
  }
});

app.get('/faq', (req, res) => {
  res.render('faq', {
    user: req.user,
    title: 'Frequently Asked Questions'
  });
});

app.get('/privacy', (req, res) => {
  res.render('privacy', {
    user: req.user,
    title: 'PRIVACY POLICY'
  });
});

app.get('/terms', (req, res) => {
  res.render('terms', {
    user: req.user,
    title: 'TERMS AND CONDITIONS'
  });
});



// app.get('/deposit', (req, res) => {
//   if (req.user) {
//     Inventory.findOne(
//       {
//         steamid: req.user.steamid
//       },
//       (err, inv) => {
//         if (inv && Date.now() - inv.updated < 6 * 60 * 60 * 1000) {
//           res.render('deposit', {
//             user: req.user,
//             items: inv.items,
//             title: 'Deposit page'
//           });
//         } else {
//           community.getUserInventoryContents(
//             req.user.steamid,
//             730,
//             2,
//             true,
//             (err, inv) => {
//               if (err) {
//                 console.log(err);
//               } else {
//                 async.map(
//                   inv,
//                   (item, done) => {
//                     Price.findOne(
//                       {
//                         market_hash_name: item.market_hash_name
//                       },
//                       (err, doc) => {
//                         item.price = doc ? doc.price : 0;
//                         item.image = `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`
//                         done(null, item);
//                       }
//                     );
//                   },
//                   (err, results) => {
//                     Inventory.updateMany(
//                       {
//                         steamid: req.user.steamid
//                       },
//                       {
//                         $set: {
//                           updated: Date.now(),
//                           items: results
//                         }
//                       },
//                       { upsert: true },
//                       err => {
//                         if (err) {
//                           console.log(err);
//                         }
//                       }
//                     );
//                     res.render('deposit', {
//                       user: req.user,
//                       items: results,
//                       title: 'Deposit page'
//                     });
//                   }
//                 );
//               }
//             }
//           );
//         }
//       }
//     ).lean();
//   } else {
//     res.redirect('/auth/steam');
//   }
// });

// app.get('/withdraw', (req, res) => {
//   if (req.user) {
//     Item.findOne(
//       {
//         steamid: config.steamConfiguration.botSteamId
//       },
//       (err, inv) => {
//         if (inv && Date.now() - inv.updated < 6 * 60 * 60 * 1000) {
//           res.render('withdraw', {
//             user: req.user,
//             items: inv.items,
//             title: 'Withdraw page'
//           });
//         } else {
//           community.getUserInventoryContents(
//             config.steamConfiguration.botSteamId,
//             730,
//             2,
//             true,
//             (err, inv) => {
//               if (err) {
//                 console.log(err);
//               } else {
//                 async.map(
//                   inv,
//                   (item, done) => {
//                     Price.findOne(
//                       {
//                         market_hash_name: item.market_hash_name
//                       },
//                       (err, doc) => {
//                         item.price = doc ? doc.price : 0;
//                         item.image = `https://community.akamai.steamstatic.com/economy/image/${item.icon_url}`
//                         done(null, item);
//                       }
//                     );
//                   },
//                   (err, results) => {
//                     Item.updateMany(
//                       {
//                         steamid: config.steamConfiguration.botSteamId
//                       },
//                       {
//                         $set: {
//                           updated: Date.now(),
//                           items: results
//                         }
//                       },
//                       { upsert: true },
//                       err => {
//                         if (err) {
//                           console.log(err);
//                         }
//                       }
//                     );
//                     res.render('withdraw', {
//                       user: req.user,
//                       items: results,
//                       title: 'Withdraw page'
//                     });
//                   }
//                 );
//               }
//             }
//           );
//         }
//       }
//     ).lean();
//   } else {
//     res.redirect('/auth/steam');
//   }
// });

app.get(
  /^\/auth\/steam(\/return)?$/,
  passport.authenticate('steam', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout();
  res.redirect('/');
});

app.get('*', (req, res) => {
  res.render('404', {
    user: req.user,
    title: 'Error page'
  });
});

server.listen(config.port, () => {
  console.log('listening');
});
