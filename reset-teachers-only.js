const mongoose = require('mongoose');

async function resetTeachersOnly() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    // Get list of all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Current collections:', collections.map(c => c.name));
    
    // Only drop the teachers collection
    try {
      await mongoose.connection.db.collection('teachers').drop();
      console.log('💥 DROPPED only teachers collection');
    } catch (error) {
      console.log('ℹ️ Teachers collection not found or already dropped');
    }
    
    // Verify remaining collections
    const remainingCollections = await mongoose.connection.db.listCollections().toArray();
    console.log('📋 Remaining collections:', remainingCollections.map(c => c.name));
    
    await mongoose.disconnect();
    console.log('✅ Teachers collection reset complete - other data preserved');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

resetTeachersOnly();