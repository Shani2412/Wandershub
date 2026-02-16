require("dotenv").config();
const { cloudinary } = require("./utils/cloudinary");
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const crypto = require("crypto");

mongoose.set("strictPopulate", false);

const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const bcrypt = require("bcrypt");
const session = require("express-session");

const Listing = require("./models/listing");
const Review = require("./models/review");
const User = require("./models/user");

const multer = require("multer");
const { storage } = require("./utils/cloudinary");
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});

/* ================= DATABASE ================= */

mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connected"))
  .catch((err) => console.log("DB Error:", err.message));

/* ================= SESSION ================= */

app.use(
  session({
    secret: process.env.SESSION_SECRET || "wanderahub-secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* ================= APP CONFIG ================= */

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

/* ================= GLOBAL USER ================= */

app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.isSeller = false;
  res.locals.requestCount = 0;

  if (!req.session.userId) return next();

  const user = await User.findById(req.session.userId);
  if (!user) {
    req.session.destroy();
    return next();
  }

  res.locals.currentUser = user;

  const ownsListing = await Listing.exists({ owner: user._id });
  res.locals.isSeller = !!ownsListing;

  if (res.locals.isSeller) {
    const count = await Listing.countDocuments({
      owner: user._id,
      "purchaseRequest.status": "pending",
      "purchaseRequest.seenBySeller": false,
    });
    res.locals.requestCount = count;
  }

  next();
});

/* ================= MIDDLEWARE ================= */

function isLoggedIn(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  next();
}

function isSeller(req, res, next) {
  if (!req.session.userId) return res.redirect("/login");
  if (!res.locals.isSeller) return res.redirect("/listings");
  next();
}

/* ================= AUTH ROUTES ================= */

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", async (req, res) => {
  const email = req.body.email.trim();
  const password = req.body.password;

  const user = await User.findOne({
    email: { $regex: new RegExp("^" + email + "$", "i") },
  });

  if (!user) {
    return res.render("login", { error: "Invalid email or password" });
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    return res.render("login", { error: "Invalid email or password" });
  }

  req.session.userId = user._id;
  res.redirect("/listings");
});

app.get("/signup", (req, res) => {
  res.render("users/signup", { error: null });
});

app.post("/signup", async (req, res) => {
  const username = req.body.username.trim();
  const email = req.body.email.trim();
  const password = req.body.password;

  const exists = await User.findOne({
    email: { $regex: new RegExp("^" + email + "$", "i") },
  });

  if (exists) {
    return res.render("users/signup", {
      error: "Email already registered",
    });
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = new User({ username, email, password: hashed });
  await user.save();

  req.session.userId = user._id;
  res.redirect("/listings");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/login"));
});

/* ================= FORGOT PASSWORD ================= */

app.get("/forgot", (req, res) => {
  res.render("users/forgot", { error: null });
});

app.post("/forgot", async (req, res) => {
  try {
    const email = req.body.email.trim();

    const user = await User.findOne({
      email: { $regex: new RegExp("^" + email + "$", "i") },
    });

    if (!user) {
      return res.render("users/forgot", {
        error: "No account with that email",
      });
    }
const token = crypto.randomBytes(32).toString("hex");

user.resetPasswordToken = token;
user.resetPasswordExpires = Date.now() + 3600000;

await user.save();

const resetUrl = `${process.env.BASE_URL}/reset/${token}`;

res.render("users/forgot-success", {
  link: resetUrl
});
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }

app.get("/reset/:token", async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.send("Token invalid or expired");
  }

  res.render("users/reset");
});

app.post("/reset/:token", async (req, res) => {
  const user = await User.findOne({
    resetPasswordToken: req.params.token,
    resetPasswordExpires: { $gt: Date.now() },
  });

  if (!user) {
    return res.send("Token invalid or expired");
  }

  const hashedPassword = await bcrypt.hash(req.body.password, 12);

  user.password = hashedPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;

  await user.save();

  res.redirect("/login");
});

/* ================= LISTINGS ================= */

app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({ isSold: false });
  res.render("listings/index", { allListings });
});

app.get("/listings/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

app.post(
  "/listings",
  isLoggedIn,
  upload.array("listing[images]", 5),
  async (req, res) => {
    try {
      if (!req.body.listing) {
        return res.render("listings/new", {
          error: "Invalid form submission",
        });
      }

      const listing = new Listing(req.body.listing);
      listing.owner = req.session.userId;

      if (req.files && req.files.length > 0) {
        listing.images = req.files.map((file) => ({
          url: file.path,
          filename: file.filename,
        }));
      }

      await listing.save();
      res.redirect(`/listings/${listing._id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.get("/listings/:id", async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate("owner")
    .populate({
      path: "reviews",
      populate: { path: "author", select: "username" },
    });

  if (!listing) return res.redirect("/listings");
  res.render("listings/show", { listing });
});

app.get("/listings/:id/edit", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);

  if (!listing || listing.isSold) return res.redirect("/listings");
  if (!listing.owner.equals(req.session.userId))
    return res.redirect(`/listings/${listing._id}`);

  res.render("listings/edit", { listing });
});

app.put(
  "/listings/:id",
  isLoggedIn,
  upload.array("listing[images]", 5),
  async (req, res) => {
    try {
      const listing = await Listing.findById(req.params.id);
      if (!listing || listing.isSold) return res.redirect("/listings");
      if (!listing.owner.equals(req.session.userId))
        return res.redirect(`/listings/${listing._id}`);

      if (req.body.listing) Object.assign(listing, req.body.listing);

      if (req.body.deleteImages) {
        const imagesToDelete = Array.isArray(req.body.deleteImages)
          ? req.body.deleteImages
          : [req.body.deleteImages];

        for (let filename of imagesToDelete) {
          await cloudinary.uploader.destroy(filename);
        }

        listing.images = listing.images.filter(
          (img) => !imagesToDelete.includes(img.filename)
        );
      }

      if (req.files && req.files.length > 0) {
        const newImages = req.files.map((file) => ({
          url: file.path,
          filename: file.filename,
        }));
        listing.images.push(...newImages);
      }

      await listing.save();
      res.redirect(`/listings/${listing._id}`);
    } catch (err) {
      console.error(err);
      res.status(500).send("Internal Server Error");
    }
  }
);

app.delete("/listings/:id", isLoggedIn, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing || listing.isSold) return res.redirect("/listings");
    if (!listing.owner.equals(req.session.userId))
      return res.redirect(`/listings/${listing._id}`);

    for (let img of listing.images) {
      await cloudinary.uploader.destroy(img.filename);
    }

    await Listing.findByIdAndDelete(req.params.id);
    res.redirect("/listings");
  } catch (err) {
    console.error(err);
    res.status(500).send("Error deleting listing");
  }
});

/* ================= BUY FLOW ================= */

app.get("/listings/:id/buy", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");
  if (listing.owner.equals(req.session.userId))
    return res.redirect(`/listings/${listing._id}`);

  res.render("listings/buy", { listing });
});

app.post("/listings/:id/buy", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");

  listing.purchaseRequest = {
    buyer: req.session.userId,
    buyerDetails: req.body,
    status: "pending",
    seenBySeller: false,
  };

  await listing.save();
  res.redirect(`/listings/${listing._id}`);
});

/* ================= SELLER ================= */

app.get("/seller/requests", isSeller, async (req, res) => {
  await Listing.updateMany(
    {
      owner: req.session.userId,
      "purchaseRequest.status": "pending",
      "purchaseRequest.seenBySeller": false,
    },
    { $set: { "purchaseRequest.seenBySeller": true } }
  );

  const listings = await Listing.find({
    owner: req.session.userId,
    "purchaseRequest.status": "pending",
  });

  res.render("seller/requests", { listings });
});

app.post("/listings/:id/approve", isSeller, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.redirect("/seller/requests");

  listing.isSold = true;
  listing.buyer = listing.purchaseRequest.buyer;
  listing.buyerDetails = listing.purchaseRequest.buyerDetails;
  listing.soldPrice = listing.price;
  listing.purchaseRequest = null;

  await listing.save();
  res.redirect("/seller/requests");
});

app.post("/listings/:id/decline", isSeller, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.redirect("/seller/requests");

  listing.purchaseRequest = null;
  await listing.save();
  res.redirect("/seller/requests");
});

/* ================= REVIEWS ================= */

app.post("/listings/:id/reviews", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.redirect("/listings");

  const review = new Review(req.body.review);
  review.author = req.session.userId;

  await review.save();
  listing.reviews.push(review._id);
  await listing.save();

  res.redirect(`/listings/${req.params.id}`);
});

app.delete(
  "/listings/:id/reviews/:reviewId",
  isLoggedIn,
  async (req, res) => {
    const { id, reviewId } = req.params;

    const listing = await Listing.findById(id);
    const review = await Review.findById(reviewId);

    if (!listing || !review) return res.redirect("back");

    const isReviewAuthor =
      review.author && review.author.equals(req.session.userId);
    const isListingOwner =
      listing.owner && listing.owner.equals(req.session.userId);

    if (!isReviewAuthor && !isListingOwner)
      return res.redirect("back");

    await Listing.findByIdAndUpdate(id, {
      $pull: { reviews: reviewId },
    });

    await Review.findByIdAndDelete(reviewId);
    res.redirect(`/listings/${id}`);
  }
);

/* ================= 404 ================= */

app.use((req, res) => {
  res.status(404).send("Page not found");
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
