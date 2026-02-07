const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
<<<<<<< HEAD
  }
=======
  },role: {
  type: String,
  enum: ["buyer", "seller"],
  default: "buyer"
}


>>>>>>> db6f97cef84d9e97ba22f93d597a233a8b10154b
});

module.exports = mongoose.model("User", userSchema);
