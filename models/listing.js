const mongoose = require("mongoose");
const Schema = mongoose.Schema;

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
