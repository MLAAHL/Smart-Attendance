const mongoose = require('mongoose');

async function investigateDatabase() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    const db = mongoose.connection.db;
    
    // List all collections
    const collections = await db.listCollections().toArray();
    console.log('📋 All collections:');
    collections.forEach(c => console.log(`  - ${c.name}`));
    
    // Check teachers collection specifically
    if (collections.find(c => c.name === 'teachers')) {
      const teachersCollection = db.collection('teachers');
      
      console.log('\n🔍 Teachers collection indexes:');
      const indexes = await teachersCollection.indexes();
      console.log(JSON.stringify(indexes, null, 2));
      
      console.log('\n📄 Sample documents:');
      const docs = await teachersCollection.find({}).limit(3).toArray();
      docs.forEach((doc, i) => {
        console.log(`Document ${i + 1}:`, JSON.stringify(doc, null, 2));
      });
      
      // FORCE drop any bad indexes
      console.log('\n🔨 Force dropping problematic indexes...');
      const badIndexNames = ['firebaseUID_1', 'firebaseUid_1'];
      for (const indexName of badIndexNames) {
        try {
          await teachersCollection.dropIndex(indexName);
          console.log(`✅ Dropped ${indexName}`);
        } catch (error) {
          console.log(`ℹ️ ${indexName} not found: ${error.message}`);
        }
      }
      
      // Drop entire collection and recreate
      console.log('\n💥 NUCLEAR: Dropping entire collection...');
      await teachersCollection.drop();
      console.log('✅ Collection dropped');
      
      // Recreate with clean indexes
      const newCollection = db.collection('teachers');
      await newCollection.createIndex({ email: 1 }, { unique: true });
      console.log('✅ Created email unique index');
      
      console.log('\n✅ Final state:');
      const finalIndexes = await newCollection.indexes();
      console.log(JSON.stringify(finalIndexes, null, 2));
    }
    
    await mongoose.disconnect();
    console.log('\n🎯 Investigation complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

investigateDatabase();