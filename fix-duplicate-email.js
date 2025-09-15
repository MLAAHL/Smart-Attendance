const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/smartAttendance');

async function fixDuplicateEmails() {
  try {
    console.log('🔧 Checking for duplicate email issues...');
    
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
    
    // Find all teachers
    const allTeachers = await teachersCollection.find({}).toArray();
    console.log(`Found ${allTeachers.length} total teacher records`);
    
    // Group by email to find duplicates
    const emailGroups = {};
    allTeachers.forEach(teacher => {
      if (teacher.email) {
        if (!emailGroups[teacher.email]) {
          emailGroups[teacher.email] = [];
        }
        emailGroups[teacher.email].push(teacher);
      }
    });
    
    // Find duplicate emails
    const duplicateEmails = Object.keys(emailGroups).filter(email => emailGroups[email].length > 1);
    
    if (duplicateEmails.length > 0) {
      console.log(`Found ${duplicateEmails.length} duplicate emails:`, duplicateEmails);
      
      // For each duplicate email, keep only the most recent one
      for (const email of duplicateEmails) {
        const teachers = emailGroups[email];
        console.log(`\nProcessing email: ${email} (${teachers.length} records)`);
        
        // Sort by creation date (most recent first)
        teachers.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
        
        // Keep the first (most recent) record, delete the rest
        const keepRecord = teachers[0];
        const deleteRecords = teachers.slice(1);
        
        console.log(`Keeping record: ${keepRecord._id} (created: ${keepRecord.createdAt || 'unknown'})`);
        
        for (const record of deleteRecords) {
          console.log(`Deleting record: ${record._id} (created: ${record.createdAt || 'unknown'})`);
          await teachersCollection.deleteOne({ _id: record._id });
        }
      }
    } else {
      console.log('No duplicate emails found');
    }
    
    // Also check for duplicate firebaseUids
    const firebaseUidGroups = {};
    const remainingTeachers = await teachersCollection.find({}).toArray();
    
    remainingTeachers.forEach(teacher => {
      if (teacher.firebaseUid) {
        if (!firebaseUidGroups[teacher.firebaseUid]) {
          firebaseUidGroups[teacher.firebaseUid] = [];
        }
        firebaseUidGroups[teacher.firebaseUid].push(teacher);
      }
    });
    
    const duplicateFirebaseUids = Object.keys(firebaseUidGroups).filter(uid => firebaseUidGroups[uid].length > 1);
    
    if (duplicateFirebaseUids.length > 0) {
      console.log(`\nFound ${duplicateFirebaseUids.length} duplicate firebaseUids:`, duplicateFirebaseUids);
      
      for (const uid of duplicateFirebaseUids) {
        const teachers = firebaseUidGroups[uid];
        console.log(`Processing firebaseUid: ${uid} (${teachers.length} records)`);
        
        // Sort by creation date (most recent first)
        teachers.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt) : new Date(0);
          const dateB = b.createdAt ? new Date(b.createdAt) : new Date(0);
          return dateB - dateA;
        });
        
        // Keep the first (most recent) record, delete the rest
        const keepRecord = teachers[0];
        const deleteRecords = teachers.slice(1);
        
        console.log(`Keeping record: ${keepRecord._id}`);
        
        for (const record of deleteRecords) {
          console.log(`Deleting duplicate firebaseUid record: ${record._id}`);
          await teachersCollection.deleteOne({ _id: record._id });
        }
      }
    } else {
      console.log('No duplicate firebaseUids found');
    }
    
    console.log('✅ Duplicate cleanup completed successfully');
    
  } catch (error) {
    console.error('❌ Error during duplicate cleanup:', error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
  }
}

// Run the cleanup
fixDuplicateEmails();
