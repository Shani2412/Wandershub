const mongoose = require("mongoose");
const Schema = mongoose.Schema;

<<<<<<< HEAD
const listingSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    image: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c",
    },

    price: {
      type: Number,
      required: true,
      min: 0,
    },

    location: {
      type: String,
      required: true,
      trim: true,
    },

    country: {
      type: String,
      required: true,
      trim: true,
    },

    isSold: {
      type: Boolean,
      default: false,
    },

    // 🔑 Seller (listing owner)
    owner: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🧑 Buyer (after purchase)
    buyer: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },

    reviews: [
      {
        type: Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
  },
  { timestamps: true }
);

// Image safety
listingSchema.pre("save", function (next) {
  if (!this.image || this.image.trim() === "") {
    this.image =
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c";
  }
  next();
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;
=======
const listingSchema = new Schema({
  title: String,
  description: String,
  image: String,
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
>>>>>>> db6f97cef84d9e97ba22f93d597a233a8b10154b
