const mongoose = require('mongoose');

async function ultimateReset() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    // Get list of all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Current collections:', collections.map(c => c.name));
    
    // DROP THE ENTIRE DATABASE
    await mongoose.connection.db.dropDatabase();
    console.log('💥💥💥 DROPPED ENTIRE DATABASE!');
    
    await mongoose.disconnect();
    console.log('✅ Ultimate reset complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

ultimateReset();