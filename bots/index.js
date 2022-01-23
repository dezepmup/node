const SteamUser = require('steam-user');
const SteamCommunity = require('steamcommunity');
const TradeOfferManager = require('steam-tradeoffer-manager');
const config = require('../config.json');

class SteamBot {
  constructor(logOnOptions) {
    this.client = new SteamUser();
    this.community = new SteamCommunity();
    this.manager = new TradeOfferManager({
      steam: this.client,
      community: this.community,
      language: 'en'
    });

    this.logOn(logOnOptions);
    //TODO:  обработать событие и записать в базу результат если саксес в юзерс (accepted === 3 , ETradeOfferStatuses === тут статусы)
    this.manager.on('sentOfferChanged', (offer) => {
      if (offer.state === 2) {
        //тут холдим баланс
        console.log('offer sended');
      } else if (offer.state === 3) {
        //тут снимаем баланс
        console.log('offer accepted');
      } else {
        // тут возвращаем баланс
        console.log('offer decline');
      }
    });
  }

  logOn(logOnOptions) {
    this.client.logOn(logOnOptions);

    this.client.on('loggedOn', () => {
      console.log('Logged into Steam');

      this.client.setPersona(SteamUser.EPersonaState.Online);
    });

    this.client.on('webSession', (sessionid, cookies) => {
      this.manager.setCookies(cookies);

      this.community.setCookies(cookies);
      this.community.startConfirmationChecker(10000, config.identitySecret);
    });
  }

  sendDepositTrade(partner, assetid, callback) {
    const offer = this.manager.createOffer(partner);

    this.manager.getUserInventoryContents(partner, 730, 2, true, (err, inv) => {
      if (err) {
        console.log(err);
      } else {
        const item = inv.find(item => item.assetid == assetid);

        if (item) {
          offer.addTheirItem(item);
          offer.setMessage('Deposit item on the website!');
          offer.send((err, status) => {
            callback(err, status === 'sent' || status === 'pending', offer.id);
          });
        } else {
          callback(new Error('Could not find item'), false);
        }
      }
    });
  }

  sendWithdrawTrade(partner, credits, assetid, price, callback) {
    const offer = this.manager.createOffer(partner);

    this.manager.getInventoryContents(730, 2, true, (err, inv) => {
      if (err) {
        console.log(err);
      } else {
        const item = inv.find(item => item.assetid == assetid);
        if (item) {
          // Check to make sure the user can afford the item here
          console.log(credits);
          console.log(price);
          offer.addMyItem(item);
          offer.setMessage('Withdraw item from the website!');
          offer.send((err, status) => {
            callback(err, status === 'sent' || status === 'pending', offer.id);
          });
        } else {
          callback(new Error('Could not find item'), false);
        }
      }
    });
  }
}




module.exports = SteamBot;
