const mongoose = require('mongoose');

async function forceCleanupDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // Check if teachers collection exists
    const collections = await db.listCollections({ name: 'teachers' }).toArray();
    
    if (collections.length > 0) {
      console.log('🔍 Teachers collection found, performing aggressive cleanup...');
      
      const collection = db.collection('teachers');
      
      // Show current state
      console.log('Current indexes:');
      const indexes = await collection.indexes();
      console.log(JSON.stringify(indexes, null, 2));
      
      // Show current documents
      const docs = await collection.find({}).toArray();
      console.log(`Found ${docs.length} documents in collection`);
      
      // DROP THE ENTIRE COLLECTION (nuclear option)
      await collection.drop();
      console.log('💥 DROPPED entire teachers collection');
      
    } else {
      console.log('ℹ️ Teachers collection does not exist');
    }
    
    // Force Mongoose to recreate the collection with correct schema
    console.log('🔄 Forcing Mongoose to recreate collection...');
    
    // Import the Teacher model to trigger schema creation
    const Teacher = require('./models/Teacher');
    
    // Create a test document and then delete it to force collection creation
    const testTeacher = new Teacher({
      firebaseUid: 'test-uid-12345',
      name: 'Test Teacher',
      email: 'test@example.com'
    });
    
    await testTeacher.save();
    console.log('✅ Test teacher created successfully');
    
    await Teacher.deleteOne({ firebaseUid: 'test-uid-12345' });
    console.log('✅ Test teacher deleted');
    
    // Show final indexes
    const finalCollection = db.collection('teachers');
    const finalIndexes = await finalCollection.indexes();
    console.log('Final indexes:');
    console.log(JSON.stringify(finalIndexes, null, 2));
    
    await mongoose.disconnect();
    console.log('✅ Force cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during force cleanup:', error);
    await mongoose.disconnect();
  }
}

forceCleanupDatabase();