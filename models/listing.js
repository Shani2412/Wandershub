const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const listingSchema = new Schema({
  title: {
    type: String,
    required: [true, "Title is required"],
    trim: true
  },

  description: {
    type: String,
    required: [true, "Description is required"],
    trim: true
  },

  image: {
    url: {
      type: String,
      required: true
    },
    filename: {
      type: String,
      required: true
    }
  },

  price: {
    type: Number,
    required: [true, "Price is required"],
    min: 0
  },

  location: {
    type: String,
    required: [true, "Location is required"],
    trim: true
  },

  country: {
    type: String,
    required: [true, "Country is required"],
    trim: true
  },

  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review"
    }
  ],

  isSold: {
    type: Boolean,
    default: false
  },

  buyer: {
    type: Schema.Types.ObjectId,
    ref: "User"
  },

  buyerDetails: {
    name: String,
    email: String,
    address: String
  },

  soldPrice: Number,

  purchaseRequest: {
    type: {
      buyer: {
        type: Schema.Types.ObjectId,
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
});

module.exports = mongoose.model("Listing", listingSchema);
