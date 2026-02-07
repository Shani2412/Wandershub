const express = require("express");
const app = express();
const mongoose = require("mongoose");

// prevent populate errors
mongoose.set("strictPopulate", false);

const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const bcrypt = require("bcrypt");
const session = require("express-session");

const Listing = require("./models/listing");
const Review = require("./models/review");
const User = require("./models/user");

require("dotenv").config();

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

/* ================= GLOBAL USER + ROLE AWARENESS ================= */
app.use(async (req, res, next) => {
  res.locals.currentUser = null;
  res.locals.isSeller = false;
  res.locals.requestCount = 0;

  if (!req.session.userId) return next();

  const user = await User.findById(req.session.userId);
  res.locals.currentUser = user;

  // REAL SELLER CHECK = USER OWNS AT LEAST ONE LISTING
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

/* ================= AUTH MIDDLEWARE ================= */
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
  const { email, password } = req.body;
  const user = await User.findOne({ email });

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
  const { username, email, password } = req.body;

  const exists = await User.findOne({ email });
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

/* ================= LISTINGS ================= */

// INDEX
app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({ isSold: false });
  res.render("listings/index", { allListings });
});

// NEW
app.get("/listings/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

// CREATE
app.post("/listings", isLoggedIn, async (req, res) => {
  const listing = new Listing(req.body.listing);
  listing.owner = req.session.userId;
  listing.purchaseRequest = null;
  await listing.save();
  res.redirect(`/listings/${listing._id}`);
});

// SHOW
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

// EDIT
app.get("/listings/:id/edit", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");

  if (!listing.owner.equals(req.session.userId)) {
    return res.redirect(`/listings/${listing._id}`);
  }

  res.render("listings/edit", { listing });
});

// UPDATE
app.put("/listings/:id", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");

  if (!listing.owner.equals(req.session.userId)) {
    return res.redirect(`/listings/${listing._id}`);
  }

  await Listing.findByIdAndUpdate(req.params.id, req.body.listing);
  res.redirect(`/listings/${req.params.id}`);
});

// DELETE
app.delete("/listings/:id", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");

  if (!listing.owner.equals(req.session.userId)) {
    return res.redirect(`/listings/${listing._id}`);
  }

  await Listing.findByIdAndDelete(req.params.id);
  res.redirect("/listings");
});

/* ================= BUY FLOW ================= */

app.get("/listings/:id/buy", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing || listing.isSold) return res.redirect("/listings");

  if (listing.owner.equals(req.session.userId)) {
    return res.redirect(`/listings/${listing._id}`);
  }

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

/* ================= SELLER REQUESTS ================= */

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

// APPROVE
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

// DECLINE
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

    if (!isReviewAuthor && !isListingOwner) {
      return res.redirect("back");
    }

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
