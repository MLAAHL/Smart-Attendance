const mongoose = require('mongoose');

async function fixIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('teachers');
    
    // Clean up existing data and indexes
    console.log('🧹 Cleaning up collection...');
    await collection.deleteMany({});
    console.log('✅ Deleted all existing teachers');
    
    // Drop all indexes except _id
    console.log('🗑️ Dropping all indexes...');
    const indexes = await collection.indexes();
    for (const index of indexes) {
      if (index.name !== '_id_') {
        try {
          await collection.dropIndex(index.name);
          console.log(`✅ Dropped index: ${index.name}`);
        } catch (error) {
          console.log(`⚠️ Could not drop index ${index.name}:`, error.message);
        }
      }
    }
    
    // Create only the email unique index (no firebaseUid index)
    await collection.createIndex({ email: 1 }, { unique: true });
    console.log('✅ Created unique index on email');
    
    // Create regular index on firebaseUid (not unique)
    await collection.createIndex({ firebaseUid: 1 });
    console.log('✅ Created regular index on firebaseUid');
    
    // Show final indexes
    console.log('\nFinal indexes:');
    const finalIndexes = await collection.indexes();
    console.log(JSON.stringify(finalIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('✅ Database setup completed');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

fixIndexes();