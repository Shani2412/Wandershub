const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: String,
  description: String,
  image: {
  url: String,
  filename: String,
},

  price: Number,
  location: String,
  country: String,

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review",
    },
  ],

  isSold: {
    type: Boolean,
    default: false,
  },

  buyer: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },

  buyerDetails: {
    name: String,
    email: String,
    address: String,
  },

  soldPrice: Number,

  purchaseRequest: {
    type: {
      buyer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
      },
      buyerDetails: {
        name: String,
        email: String,
        address: String
      },
      status: {
        type: String,
        enum: ["pending"],
        default: "pending"
      },
      seenBySeller: {
        type: Boolean,
        default: false
      }
    },
    default: null
  }
  ,

});

module.exports = mongoose.model("Listing", listingSchema);
