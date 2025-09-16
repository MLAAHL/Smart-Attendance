const mongoose = require('mongoose');
const Teacher = require('./models/TeacherNew');

async function testNewModel() {
  try {
    await mongoose.connect('mongodb://localhost:27017/Attendance');
    console.log('✅ Connected to MongoDB');
    
    // Drop the teachers collection to start fresh
    await mongoose.connection.db.collection('teachers').drop();
    console.log('💥 Dropped teachers collection');
    
    // Test creating teachers
    console.log('\n🧪 Testing new model...');
    
    // Teacher 1: With Firebase UID
    const teacher1 = new Teacher({
      firebaseUid: 'test-firebase-uid-1',
      name: 'John Doe',
      email: 'john@test.com'
    });
    await teacher1.save();
    console.log('✅ Teacher 1 created');
    
    // Teacher 2: Without Firebase UID (null)
    const teacher2 = new Teacher({
      firebaseUid: null,
      name: 'Jane Smith', 
      email: 'jane@test.com'
    });
    await teacher2.save();
    console.log('✅ Teacher 2 created');
    
    // Teacher 3: Another without Firebase UID
    const teacher3 = new Teacher({
      firebaseUid: null,
      name: 'Bob Johnson',
      email: 'bob@test.com'
    });
    await teacher3.save();
    console.log('✅ Teacher 3 created');
    
    // Teacher 4: Undefined Firebase UID
    const teacher4 = new Teacher({
      name: 'Alice Brown',
      email: 'alice@test.com'
    });
    await teacher4.save();
    console.log('✅ Teacher 4 created');
    
    console.log('\n📋 All teachers:');
    const allTeachers = await Teacher.find({});
    allTeachers.forEach((t, i) => {
      console.log(`${i+1}. ${t.name} (${t.email}) - Firebase UID: ${t.firebaseUid || 'null/undefined'}`);
    });
    
    await mongoose.disconnect();
    console.log('\n🎉 SUCCESS! Multiple teachers with null Firebase UID created!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    await mongoose.disconnect();
  }
}

testNewModel();