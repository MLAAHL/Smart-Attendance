const mongoose = require('mongoose');

async function cleanupIndexes() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('Available collections:', collections.map(c => c.name));
    
    // Check if teachers collection exists
    const teachersCollection = collections.find(c => c.name === 'teachers');
    
    if (!teachersCollection) {
      console.log('ℹ️ Teachers collection does not exist yet');
      await mongoose.disconnect();
      return;
    }
    
    const collection = db.collection('teachers');
    
    console.log('Checking existing indexes...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', JSON.stringify(indexes, null, 2));
    
    // Check existing documents
    const documents = await collection.find({}).toArray();
    console.log(`Found ${documents.length} existing documents`);
    if (documents.length > 0) {
      console.log('Sample document:', JSON.stringify(documents[0], null, 2));
    }
    
    // Drop problematic indexes
    const problemIndexes = ['firebaseUID_1', 'firebaseUid_1'];
    for (const indexName of problemIndexes) {
      try {
        await collection.dropIndex(indexName);
        console.log(`✅ Dropped index: ${indexName}`);
      } catch (error) {
        console.log(`ℹ️ Index ${indexName} not found or already dropped`);
      }
    }
    
    // Drop the entire collection to start fresh
    try {
      await collection.drop();
      console.log('🗑️ Dropped entire teachers collection to start fresh');
    } catch (error) {
      console.log('⚠️ Error dropping collection:', error.message);
    }
    
    await mongoose.disconnect();
    console.log('✅ Database cleanup completed successfully');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    await mongoose.disconnect();
  }
}

cleanupIndexes();