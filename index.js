const mongoose = require('mongoose');
const initdata = require('./data.js');
const Listing = require('../models/listing.js');

main().then(() => {
  console.log('Database connection established');
}).catch(err => {
  console.error('Database connection error:', err);
});

async function main() {
  await mongoose.connect('mongodb://127.0.0.1:27017/wandershub');
}

const initDB = async () => {
  await Listing.deleteMany({});
  const res = await Listing.insertMany(initdata.data);
  console.log('Database was initialized with sample data.');
}

initDB();
