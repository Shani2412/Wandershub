const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate = require("ejs-mate");
const bcrypt = require("bcrypt");
const session = require("express-session");

const Listing = require("./models/listing");
const Review = require("./models/review");
const User = require("./models/user");

require("dotenv").config();

app.get("/force-test", async (req, res) => {
  const u = new User({
    username: "forceuser",
    email: "force@test.com",
    password: "123456"
  });

  await u.save();

  res.send("FORCE INSERT DONE");
});

/* ================= SESSION ================= */
app.use(
  session({
    secret: process.env.SESSION_SECRET || "wanderahub-secret",
    resave: false,
    saveUninitialized: false,
  })
);

/* ================= DATABASE ================= */
mongoose
  .connect(process.env.MONGO_URL)
  .then(() => console.log("DB Connected"))
  .catch((err) => console.log(err));

/* ================= APP CONFIG ================= */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.engine("ejs", ejsMate);

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "public")));

/* ================= AUTH MIDDLEWARE ================= */
function isLoggedIn(req, res, next) {
  if (!req.session.userId) {
    return res.redirect("/login");
  }
  next();
}

/* ================= AUTH ROUTES ================= */
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return res.send("Invalid email or password");

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.send("Invalid email or password");

  req.session.userId = user._id;
  res.redirect("/listings");
});

app.get("/signup", (req, res) => {
  res.render("users/signup");
});

app.post("/signup", async (req, res) => {
  const { username, email, password } = req.body;

  const exists = await User.findOne({ email });
  if (exists) return res.send("Email already registered");

  const hashed = await bcrypt.hash(password, 12);
  const user = new User({ username, email, password: hashed });
  await user.save();

  // ✅ auto login after signup
  req.session.userId = user._id;
  res.redirect("/listings");
});

app.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/login");
  });
});

/* ================= LISTINGS ================= */

// INDEX
app.get("/listings", async (req, res) => {
  const allListings = await Listing.find({});
  res.render("listings/index", { allListings });
});

// NEW
app.get("/listings/new", isLoggedIn, (req, res) => {
  res.render("listings/new");
});

// CREATE (FINAL SAFE VERSION)
app.post("/listings", isLoggedIn, async (req, res) => {
  if (!req.body.listing) {
    return res.send("Invalid listing data");
  }

  const listing = new Listing(req.body.listing);
  listing.owner = req.session.userId;

  await listing.save();
  res.redirect(`/listings/${listing._id}`);
});

// SHOW
app.get("/listings/:id", async (req, res) => {
  const listing = await Listing.findById(req.params.id)
    .populate("owner")
    .populate("buyer")
    .populate("reviews");

  if (!listing) return res.send("Listing not found");
  res.render("listings/show", { listing });
});

// EDIT
app.get("/listings/:id/edit", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  res.render("listings/edit", { listing });
});

// UPDATE
app.put("/listings/:id", isLoggedIn, async (req, res) => {
  await Listing.findByIdAndUpdate(req.params.id, req.body.listing);
  res.redirect(`/listings/${req.params.id}`);
});

// DELETE
app.delete("/listings/:id", isLoggedIn, async (req, res) => {
  await Listing.findByIdAndDelete(req.params.id);
  res.redirect("/listings");
});

// BUY
app.put("/listings/:id/buy", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.send("Listing not found");

  if (listing.isSold) return res.send("Already sold");
  if (listing.owner.equals(req.session.userId)) {
    return res.send("You cannot buy your own listing");
  }

  listing.isSold = true;
  listing.buyer = req.session.userId;
  await listing.save();

  res.redirect(`/listings/${listing._id}`);
});

/* ================= REVIEWS ================= */
app.post("/listings/:id/reviews", isLoggedIn, async (req, res) => {
  const listing = await Listing.findById(req.params.id);
  if (!listing) return res.send("Listing not found");

  const review = new Review(req.body.review);
  await review.save();

  listing.reviews.push(review);
  await listing.save();

  res.redirect(`/listings/${req.params.id}`);
});

app.get("/force-test", async (req, res) => {
  try {
    const u = new User({
      username: "forceuser",
      email: "force@test.com",
      password: "123456"
    });

    await u.save();
    res.send("FORCE INSERT DONE");
  } catch (e) {
    console.error(e);
    res.send("ERROR: " + e.message);
  }
});


/* ================= 404 ================= */
app.use((req, res) => {
  res.status(404).send("Page not found");
});

/* ================= SERVER ================= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
