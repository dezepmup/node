const mongoose = require('mongoose');

module.exports = mongoose.model('Item', {
  steamid: String,
  updated: Number,
  items: [
    {
      market_name: String,
      market_hash_name: String,
      assetid: String,
      image: String,
      price: Number
    }
  ]
});
