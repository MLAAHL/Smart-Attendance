const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/smartAttendance');

async function cleanupDatabase() {
  try {
    console.log('🔧 Starting database cleanup...');
    
    // Wait for connection to be ready
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) {
        resolve();
      } else {
        mongoose.connection.once('open', resolve);
      }
    });
    
    // Get the teachers collection
    const db = mongoose.connection.db;
    const teachersCollection = db.collection('teachers');
    
    // Find all records with null or missing firebaseUid/firebaseUID
    const recordsWithNullFirebaseUid = await teachersCollection.find({
      $or: [
        { firebaseUid: null },
        { firebaseUid: { $exists: false } },
        { firebaseUID: null },
        { firebaseUID: { $exists: false } }
      ]
    }).toArray();
    
    console.log(`Found ${recordsWithNullFirebaseUid.length} records with null/missing firebaseUid`);
    
    if (recordsWithNullFirebaseUid.length > 0) {
      // Delete records with null firebaseUid
      const deleteResult = await teachersCollection.deleteMany({
        $or: [
          { firebaseUid: null },
          { firebaseUid: { $exists: false } },
          { firebaseUID: null },
          { firebaseUID: { $exists: false } }
        ]
      });
      
      console.log(`🗑️ Deleted ${deleteResult.deletedCount} records with null firebaseUid`);
    }
    
    // Check for any firebaseUID field (wrong casing) and rename to firebaseUid
    const recordsWithWrongCasing = await teachersCollection.find({
      firebaseUID: { $exists: true }
    }).toArray();
    
    if (recordsWithWrongCasing.length > 0) {
      console.log(`Found ${recordsWithWrongCasing.length} records with firebaseUID (wrong casing)`);
      
      // Rename firebaseUID to firebaseUid
      await teachersCollection.updateMany(
        { firebaseUID: { $exists: true } },
        { $rename: { firebaseUID: "firebaseUid" } }
      );
      
      console.log('✅ Renamed firebaseUID to firebaseUid');
    }
    
    // Drop any existing indexes on firebaseUID
    try {
      await teachersCollection.dropIndex({ firebaseUID: 1 });
      console.log('🗑️ Dropped firebaseUID index');
    } catch (error) {
      console.log('ℹ️ No firebaseUID index to drop');
    }
    
    // Ensure proper index on firebaseUid
    try {
      await teachersCollection.createIndex({ firebaseUid: 1 }, { unique: true, sparse: true });
      console.log('✅ Created unique index on firebaseUid');
    } catch (error) {
      console.log('ℹ️ firebaseUid index already exists');
    }
    
    console.log('✅ Database cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during database cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
cleanupDatabase();
