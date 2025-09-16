const mongoose = require('mongoose');

async function nuclearReset() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // NUCLEAR OPTION: Drop the entire teachers collection
    try {
      await db.collection('teachers').drop();
      console.log('💥 COMPLETELY DROPPED teachers collection');
    } catch (error) {
      console.log('ℹ️ Teachers collection did not exist or already dropped');
    }
    
    // Wait a moment for the drop to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Now recreate with simple schema - no unique constraints on firebaseUid
    const collection = db.collection('teachers');
    
    // Create only email unique index
    await collection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created email unique index');
    
    // Create simple index on firebaseUid (not unique)
    await collection.createIndex({ firebaseUid: 1 });
    console.log('✅ Created simple firebaseUid index');
    
    console.log('\nFinal indexes:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    await mongoose.disconnect();
    console.log('✅ Nuclear reset completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

nuclearReset();