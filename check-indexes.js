const mongoose = require('mongoose');

async function checkIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('teachers');
    
    // Show current indexes
    console.log('Current indexes:');
    const indexes = await collection.indexes();
    console.log(JSON.stringify(indexes, null, 2));
    
    // Drop the problematic index and recreate it properly
    console.log('\n🔄 Recreating firebaseUid index...');
    
    try {
      await collection.dropIndex('firebaseUid_1');
      console.log('✅ Dropped firebaseUid_1 index');
    } catch (error) {
      console.log('ℹ️ Index not found or already dropped');
    }
    
    // Create sparse unique index properly
    await collection.createIndex(
      { firebaseUid: 1 }, 
      { 
        unique: true, 
        sparse: true,
        name: 'firebaseUid_sparse_unique'
      }
    );
    console.log('✅ Created new sparse unique index on firebaseUid');
    
    // Show final indexes
    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    console.log(JSON.stringify(finalIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('✅ Index recreation completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

checkIndexes();