const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const BaseAttendance = require("../models/BaseAttendance");
const sendWhatsAppMessage = require('../utils/sendWhatsAppMessage');

// ✅ Enhanced Schema (No section handling needed)
const studentSchema = new mongoose.Schema({
  studentID: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    uppercase: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  parentPhone: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[\+]?[0-9]{10,15}$/.test(v.replace(/[\s\-\(\)]/g, ''));
      },
      message: "Please enter a valid phone number"
    }
  },
  isActive: {
    type: Boolean,
    default: true
  },
  migrationGeneration: {
    type: Number,
    default: 0
  },
  originalSemester: {
    type: Number,
    required: true,
    default: function() { return this.semester; }
  },
  lastMigrationDate: {
    type: Date,
    default: null
  },
  migrationBatch: {
    type: String,
    default: null
  },
  addedToSemesterDate: {
    type: Date,
    default: Date.now
  },
  migrationHistory: [{
    fromSemester: Number,
    toSemester: Number,
    migratedDate: Date,
    migrationBatch: String,
    generation: Number
  }],
  academicYear: {
    type: String,
    default: () => new Date().getFullYear().toString()
  }
}, {
  timestamps: true,
  strict: false
});

// ✅ Subject Schema (No section handling needed)
const subjectSchema = new mongoose.Schema({
  subjectName: {
    type: String,
    required: true,
    trim: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true,
    min: 1,
    max: 8
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  strict: false
});

// ✅ Attendance Schema (No section handling needed)
const attendanceSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true
  },
  subject: {
    type: String,
    required: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true
  },
  studentsPresent: {
    type: [String],
    default: []
  },
  totalStudents: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ✅ Message Log Schema (No section handling needed)
const messageLogSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  stream: {
    type: String,
    required: true,
    uppercase: true
  },
  semester: {
    type: Number,
    required: true
  },
  messagesSent: {
    type: Number,
    default: 0
  },
  messagesFailed: {
    type: Number,
    default: 0
  },
  totalStudentsNotified: {
    type: Number,
    default: 0
  },
  fullDayAbsentCount: {
    type: Number,
    default: 0
  },
  partialDayAbsentCount: {
    type: Number,
    default: 0
  },
  subjectsIncluded: [{
    type: String
  }],
  sentAt: {
    type: Date,
    default: Date.now
  },
  sentBy: {
    type: String,
    default: 'manual'
  },
  whatsappResults: [{
    studentID: String,
    studentName: String,
    success: Boolean,
    messageType: String,
    error: String
  }]
}, {
  timestamps: true
});

// ✅ FIXED: Stream mappings - BCom Section B is its own stream
const STREAM_MAPPINGS = {
  "BCA": "bca",
  "BBA": "bba",
  "BCom": "bcom",
  "BCom Section B": "bcomsectionb",  // ✅ Separate stream
  "BCom-BDA": "bcom-bda",
  "BCom A and F": "bcom_a_and_f"
};

// ✅ SIMPLIFIED: Collection name function (no section parameters)
function getCollectionName(stream, semester, type) {
  console.log(`🗂️ Input: stream="${stream}", semester="${semester}", type="${type}"`);
  
  const streamCode = STREAM_MAPPINGS[stream];
  if (!streamCode) {
    throw new Error(`Unknown stream: ${stream}`);
  }
  
  const collectionName = `${streamCode}_sem${semester}_${type}`;
  console.log(`🗂️ Output: "${collectionName}"`);
  return collectionName;
}

// Enhanced Dynamic Model Loaders with caching
const modelCache = new Map();

// ✅ SIMPLIFIED: Student Model (no section parameters)
function getStudentModel(stream, sem) {
  if (!stream || !sem) {
    throw new Error("Stream and semester are required");
  }
  
  const modelName = getCollectionName(stream, sem, "students");
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, studentSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created model for collection: ${modelName}`);
  return model;
}

// ✅ SIMPLIFIED: Subject Model (no section parameters)
function getSubjectModel(stream, sem) {
  if (!stream || !sem) {
    throw new Error("Stream and semester are required");
  }
  
  const modelName = getCollectionName(stream, sem, "subjects");
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, subjectSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created subject model for collection: ${modelName}`);
  return model;
}

// ✅ SIMPLIFIED: Attendance Model (no section parameters)
function getAttendanceModel(stream, sem, subject) {
  if (!stream || !sem || !subject) {
    throw new Error("Stream, semester, and subject are required");
  }
  
  const streamCode = STREAM_MAPPINGS[stream];
  if (!streamCode) {
    throw new Error(`Unknown stream: ${stream}`);
  }
  
  const cleanSubject = subject.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const modelName = `${streamCode}_sem${sem}_${cleanSubject}_attendance`;
  
  if (modelCache.has(modelName)) {
    return modelCache.get(modelName);
  }
  
  const model = mongoose.models[modelName] || mongoose.model(modelName, attendanceSchema, modelName);
  modelCache.set(modelName, model);
  
  console.log(`✅ Created attendance model: ${modelName}`);
  return model;
}

// Message Log Model
function getMessageLogModel() {
  return mongoose.models.message_logs || mongoose.model('message_logs', messageLogSchema);
}

// ✅ SIMPLIFIED: Input Validation Middleware (no section validation)
const validateParams = (req, res, next) => {
  const { stream, sem } = req.params;
  
  if (!stream || !sem) {
    return res.status(400).json({ 
      success: false,
      message: "Stream and semester are required" 
    });
  }
  
  if (isNaN(sem) || parseInt(sem) < 1 || parseInt(sem) > 8) {
    return res.status(400).json({ 
      success: false,
      message: "Invalid semester. Must be between 1-8" 
    });
  }
  
  // ✅ Validate streams
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  next();
};

// Helper function for active student query
const getActiveStudentQuery = () => ({
  $or: [
    { isActive: true },
    { isActive: { $exists: false } },
    { isActive: null }
  ]
});

// ✅ API ROUTES (SIMPLIFIED - NO SECTION PARAMETERS)



// ✅ GET Promotion Options
// Get promotion options
// ✅ GET Promotion Options - Updated with BCom Section B
router.get("/promotion-options", async (req, res) => {
  try {
    res.json({
      success: true,
      message: "Simple promotion system is ready",
      availableStreams: [
        { code: "BCA", name: "Bachelor of Computer Applications" },
        { code: "BBA", name: "Bachelor of Business Administration" },
        { code: "BCom", name: "Bachelor of Commerce (Section A)" },
        { code: "BCom Section B", name: "Bachelor of Commerce (Section B)" }, // ✅ ADDED
        { code: "BCom-BDA", name: "Bachelor of Commerce - Big Data Analytics" },
        { code: "BCom A and F", name: "Bachelor of Commerce - Accounting and Finance" }
      ],
      maxSemesters: 6,
      specialStreams: {
        "BCom Section B": {
          note: "Limited to semesters 5-6 only",
          availableSemesters: [5, 6]
        }
      },
      features: [
        "Simple one-click promotion",
        "All students move up one semester", 
        "Auto graduation for 6th semester",
        "Bulk upload for Semester 1",
        "Support for separate stream collections",
        "Manual WhatsApp messaging system",
        "Message tracking and duplicate prevention"
      ]
    });
  } catch (error) {
    console.error("Error in promotion-options:", error);
    res.status(500).json({ 
      success: false,
      message: "Server error",
      error: error.message 
    });
  }
});

// ✅ FIXED: Simple promotion system with BCom Section B support
router.post("/simple-promotion/:stream", async (req, res) => {
  const { stream } = req.params;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    console.log(`Starting simple promotion for ${stream.toUpperCase()}`);
    
    const promotionDate = new Date();
    const promotionBatch = `simple_promotion_${stream.replace(/\s+/g, '_')}_${Date.now()}`;
    let totalPromoted = 0;
    let totalGraduated = 0;
    const promotionDetails = [];
    
    // ✅ Handle BCom Section B (only semesters 5-6)
    let semesterRange;
    if (stream === 'BCom Section B') {
      semesterRange = [5, 6];
      console.log('📚 Processing BCom Section B - Limited to semesters 5-6');
    } else {
      semesterRange = [1, 2, 3, 4, 5, 6];
      console.log('📚 Processing regular stream - Full semester range 1-6');
    }
    
    // Start transaction for data consistency
    const session = await mongoose.startSession();
    
    try {
      await session.withTransaction(async () => {
        
        // Step 1: Handle graduation (6th semester students)
        if (semesterRange.includes(6)) {
          try {
            const Semester6Students = getStudentModel(stream, 6);
            const semester6Count = await Semester6Students.countDocuments().session(session);
            
            if (semester6Count > 0) {
              // Get student details before deletion for logging
              const graduatingStudents = await Semester6Students.find({}).session(session);
              
              // Delete 6th semester students (graduated)
              await Semester6Students.deleteMany({}).session(session);
              totalGraduated = semester6Count;
              
              console.log(`Graduated ${totalGraduated} students from Semester 6`);
              promotionDetails.push({
                action: 'graduation',
                semester: 6,
                count: totalGraduated,
                students: graduatingStudents.map(s => ({ id: s.studentID, name: s.name }))
              });
            }
          } catch (error) {
            console.error(`Error handling Semester 6 graduation:`, error);
            // Continue with other semesters even if 6th semester fails
          }
        }
        
        // Step 2: Promote students
        const promotionPairs = [];
        if (stream === 'BCom Section B') {
          // BCom Section B: only 5→6 promotion
          promotionPairs.push({ from: 5, to: 6 });
        } else {
          // Regular streams: 5→6, 4→5, 3→4, 2→3, 1→2
          for (let fromSem = 5; fromSem >= 1; fromSem--) {
            promotionPairs.push({ from: fromSem, to: fromSem + 1 });
          }
        }
        
        for (const { from: fromSem, to: toSem } of promotionPairs) {
          try {
            const SourceStudent = getStudentModel(stream, fromSem);
            const TargetStudent = getStudentModel(stream, toSem);
            
            // Get all active students in source semester
            const studentsToPromote = await SourceStudent.find(getActiveStudentQuery()).session(session);
            
            console.log(`Promoting ${stream} Semester ${fromSem}→${toSem}: ${studentsToPromote.length} students`);
            
            if (studentsToPromote.length > 0) {
              // Create students in target semester
              const promotedStudents = studentsToPromote.map(student => ({
                studentID: student.studentID,
                name: student.name,
                stream: student.stream,
                semester: toSem,
                parentPhone: student.parentPhone,
                isActive: true,
                migrationGeneration: (student.migrationGeneration || 0) + 1,
                originalSemester: student.originalSemester || fromSem,
                addedToSemesterDate: promotionDate,
                lastMigrationDate: promotionDate,
                migrationBatch: promotionBatch,
                migrationHistory: [
                  ...(student.migrationHistory || []),
                  {
                    fromSemester: fromSem,
                    toSemester: toSem,
                    migratedDate: promotionDate,
                    migrationBatch: promotionBatch,
                    generation: (student.migrationGeneration || 0) + 1
                  }
                ],
                academicYear: new Date().getFullYear().toString()
              }));
              
              // Insert all promoted students to target semester
              await TargetStudent.insertMany(promotedStudents, { session });
              
              // Remove students from source semester
              await SourceStudent.deleteMany({}).session(session);
              
              totalPromoted += studentsToPromote.length;
              
              promotionDetails.push({
                action: 'promotion',
                fromSemester: fromSem,
                toSemester: toSem,
                count: studentsToPromote.length,
                students: studentsToPromote.map(s => ({ id: s.studentID, name: s.name }))
              });
            }
          } catch (error) {
            console.error(`Error promoting from Semester ${fromSem} to ${toSem}:`, error);
            throw error; // Re-throw to abort transaction
          }
        }
        
      });
      
    } finally {
      await session.endSession();
    }
    
    console.log(`Simple promotion completed: ${totalPromoted} promoted, ${totalGraduated} graduated`);
    
    // ✅ Build promotion flow based on stream type
    let promotionFlow;
    if (stream === 'BCom Section B') {
      promotionFlow = [
        "Semester 5 → Semester 6",
        `Semester 6 → Graduated (${totalGraduated} students removed)`
      ];
    } else {
      promotionFlow = [
        "Semester 1 → Semester 2",
        "Semester 2 → Semester 3", 
        "Semester 3 → Semester 4",
        "Semester 4 → Semester 5",
        "Semester 5 → Semester 6",
        `Semester 6 → Graduated (${totalGraduated} students removed)`
      ];
    }
    
    res.json({
      success: true,
      message: `Simple Promotion Completed for ${stream.toUpperCase()}!`,
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      promotionDate: promotionDate.toISOString(),
      promotionBatch: promotionBatch,
      totalPromoted: totalPromoted,
      totalGraduated: totalGraduated,
      promotionFlow: promotionFlow,
      promotionDetails: promotionDetails,
      note: stream === 'BCom Section B' 
        ? "BCom Section B students promoted. Only semester 5 is now empty for new admissions."
        : "All students moved up one semester. Semester 1 is now empty for new admissions."
    });
    
  } catch (error) {
    console.error("Error in simple promotion:", error);
    res.status(500).json({
      success: false,
      message: "Failed to execute simple promotion",
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ✅ FIXED: Promotion preview with BCom Section B support
router.get("/simple-promotion-preview/:stream", async (req, res) => {
  const { stream } = req.params;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    const summary = {};
    let totalStudents = 0;
    const semesterDetails = [];
    
    // ✅ Determine semester range based on stream
    const semesterRange = stream === 'BCom Section B' ? [5, 6] : [1, 2, 3, 4, 5, 6];
    
    // Count students in each semester
    for (const sem of semesterRange) {
      try {
        const Student = getStudentModel(stream, sem);
        const count = await Student.countDocuments(getActiveStudentQuery());
        summary[`semester${sem}`] = count;
        totalStudents += count;
        
        let afterPromotion;
        if (sem === 6) {
          afterPromotion = 'Graduated';
        } else if (stream === 'BCom Section B' && sem === 5) {
          afterPromotion = summary[`semester${sem - 1}`] || 0; // Will be 0 since no sem 4 in Section B
        } else {
          afterPromotion = summary[`semester${sem - 1}`] || 0;
        }
        
        semesterDetails.push({
          semester: sem,
          currentCount: count,
          afterPromotion: afterPromotion
        });
      } catch (error) {
        console.error(`Error counting students in Semester ${sem}:`, error);
        summary[`semester${sem}`] = 0;
      }
    }
    
    // ✅ Build promotion preview based on stream type
    let promotionPreview;
    if (stream === 'BCom Section B') {
      promotionPreview = [
        `Semester 5 (${summary.semester5 || 0}) → Semester 6`,
        `Semester 6 (${summary.semester6 || 0}) → Will Graduate & Be Removed`
      ];
    } else {
      promotionPreview = [
        `Semester 1 (${summary.semester1 || 0}) → Semester 2`,
        `Semester 2 (${summary.semester2 || 0}) → Semester 3`,
        `Semester 3 (${summary.semester3 || 0}) → Semester 4`, 
        `Semester 4 (${summary.semester4 || 0}) → Semester 5`,
        `Semester 5 (${summary.semester5 || 0}) → Semester 6`,
        `Semester 6 (${summary.semester6 || 0}) → Will Graduate & Be Removed`
      ];
    }
    
    res.json({
      success: true,
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      totalStudents: totalStudents,
      semesterBreakdown: summary,
      semesterDetails: semesterDetails,
      promotionPreview: promotionPreview,
      warnings: [
        (summary.semester6 || 0) > 0 ? `${summary.semester6} students will graduate and be permanently removed` : null,
        totalStudents === 0 ? 'No students found in this stream' : null
      ].filter(Boolean),
      note: stream === 'BCom Section B' 
        ? "BCom Section B promotion affects only semesters 5-6"
        : "Simple promotion moves ALL students up one semester"
    });
    
  } catch (error) {
    console.error("Error getting simple promotion preview:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get promotion preview",
      error: error.message
    });
  }
});

// ✅ FIXED: Promotion history with BCom Section B support
router.get("/promotion-history/:stream", async (req, res) => {
  const { stream } = req.params;
  const { page = 1, limit = 10 } = req.query;
  
  // ✅ Updated stream validation
  const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
  if (!stream || !validStreams.includes(stream)) {
    return res.status(400).json({
      success: false,
      message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
    });
  }
  
  try {
    // This would require a separate promotion history collection
    // For now, return a placeholder response
    res.json({
      success: true,
      message: "Promotion history endpoint ready",
      stream: stream.toUpperCase(),
      streamType: stream === 'BCom Section B' ? 'Limited Stream (5-6)' : 'Full Stream (1-6)',
      note: "History tracking will be implemented with a separate collection",
      plannedFeatures: [
        "Promotion batch tracking",
        "Student migration history",
        "Rollback capabilities",
        "Detailed promotion logs"
      ]
    });
    
  } catch (error) {
    console.error("Error getting promotion history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get promotion history",
      error: error.message
    });
  }
});

// ✅ BONUS: Get stream info route
router.get("/stream-info/:stream", async (req, res) => {
  const { stream } = req.params;
  
  try {
    const validStreams = ['BCA', 'BBA', 'BCom', 'BCom Section B', 'BCom-BDA', 'BCom A and F'];
    if (!validStreams.includes(stream)) {
      return res.status(400).json({
        success: false,
        message: `Invalid stream. Must be one of: ${validStreams.join(', ')}`
      });
    }
    
    const semesterRange = stream === 'BCom Section B' ? [5, 6] : [1, 2, 3, 4, 5, 6];
    const collectionNames = [];
    const studentCounts = {};
    
    for (const sem of semesterRange) {
      try {
        const Student = getStudentModel(stream, sem);
        collectionNames.push(Student.collection.name);
        const count = await Student.countDocuments(getActiveStudentQuery());
        studentCounts[`semester${sem}`] = count;
      } catch (error) {
        console.error(`Error accessing semester ${sem}:`, error);
        studentCounts[`semester${sem}`] = 0;
      }
    }
    
    res.json({
      success: true,
      stream: stream,
      streamType: stream === 'BCom Section B' ? 'Limited Stream' : 'Full Stream',
      availableSemesters: semesterRange,
      collections: collectionNames,
      studentCounts: studentCounts,
      totalStudents: Object.values(studentCounts).reduce((sum, count) => sum + count, 0)
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to get stream info",
      error: error.message
    });
  }
});

// ✅ ADD SINGLE STUDENT Route
router.post("/add-student/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { studentID, name, parentPhone } = req.body;
  
  // Validation
  if (!studentID || !name || !parentPhone) {
    return res.status(400).json({ 
      success: false,
      message: "All fields are required: studentID, name, parentPhone" 
    });
  }
  
  // Phone validation
  const phoneRegex = /^[\+]?[0-9]{10,15}$/;
  if (!phoneRegex.test(parentPhone.replace(/[\s\-\(\)]/g, ''))) {
    return res.status(400).json({ 
      success: false,
      message: "Please enter a valid phone number (10-15 digits)" 
    });
  }
  
  try {
    const Student = getStudentModel(stream, sem);
    
    // Check if student already exists
    const existingStudent = await Student.findOne({ studentID });
    if (existingStudent) {
      return res.status(409).json({ 
        success: false,
        message: "Student ID already exists in this semester" 
      });
    }
    
    // Create new student
    const newStudent = new Student({
      studentID: studentID.trim().toUpperCase(),
      name: name.trim(),
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      parentPhone: parentPhone.trim(),
      isActive: true,
      migrationGeneration: 0,
      originalSemester: parseInt(sem),
      addedToSemesterDate: new Date(),
      academicYear: new Date().getFullYear().toString()
    });
    
    await newStudent.save();
    
    console.log(`✅ Student added: ${studentID} to ${stream} Semester ${sem}`);
    
    res.status(201).json({
      success: true,
      message: "✅ Student added successfully",
      student: {
        studentID: newStudent.studentID,
        name: newStudent.name,
        stream: newStudent.stream,
        semester: newStudent.semester,
        migrationGeneration: newStudent.migrationGeneration,
        originalSemester: newStudent.originalSemester,
        addedDate: newStudent.addedToSemesterDate
      }
    });
    
  } catch (error) {
    console.error("❌ Error adding student:", error);
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        message: "Student ID already exists" 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: "Failed to add student",
      error: error.message 
    });
  }
});

// ✅ BULK UPLOAD STUDENTS Route
router.post("/bulk-upload-students/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { students } = req.body;
  
  if (!students || !Array.isArray(students) || students.length === 0) {
    return res.status(400).json({ 
      success: false,
      message: "Students array is required and must not be empty" 
    });
  }
  
  try {
    const Student = getStudentModel(stream, sem);
    const results = [];
    let addedCount = 0;
    let failedCount = 0;
    
    console.log(`📚 Starting bulk upload: ${students.length} students to ${stream} Semester ${sem}`);
    
    for (const studentData of students) {
      const { studentID, name, parentPhone } = studentData;
      
      // Validation for each student
      if (!studentID || !name || !parentPhone) {
        results.push({
          studentID: studentID || 'UNKNOWN',
          name: name || 'UNKNOWN', 
          success: false,
          error: "Missing required fields: studentID, name, parentPhone"
        });
        failedCount++;
        continue;
      }
      
      // Phone validation
      const phoneRegex = /^[\+]?[0-9]{10,15}$/;
      if (!phoneRegex.test(parentPhone.replace(/[\s\-\(\)]/g, ''))) {
        results.push({
          studentID,
          name,
          success: false,
          error: "Invalid phone number format"
        });
        failedCount++;
        continue;
      }
      
      try {
        // Check if student already exists
        const existingStudent = await Student.findOne({ studentID });
        if (existingStudent) {
          results.push({
            studentID,
            name,
            success: false,
            error: "Student ID already exists"
          });
          failedCount++;
          continue;
        }
        
        // Create new student
        const newStudent = new Student({
          studentID: studentID.trim().toUpperCase(),
          name: name.trim(),
          stream: stream.toUpperCase(),
          semester: parseInt(sem),
          parentPhone: parentPhone.trim(),
          isActive: true,
          migrationGeneration: 0,
          originalSemester: parseInt(sem),
          addedToSemesterDate: new Date(),
          academicYear: new Date().getFullYear().toString()
        });
        
        await newStudent.save();
        addedCount++;
        
        results.push({
          studentID,
          name,
          success: true,
          message: "Student added successfully"
        });
        
      } catch (error) {
        results.push({
          studentID,
          name,
          success: false,
          error: error.message
        });
        failedCount++;
      }
    }
    
    console.log(`✅ Bulk upload completed: ${addedCount}/${students.length} students added to ${stream} Semester ${sem}`);
    
    res.status(200).json({
      success: true,
      message: `✅ Bulk upload completed: ${addedCount}/${students.length} students added`,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      total: students.length,
      added: addedCount,
      failed: failedCount,
      results: results
    });
    
  } catch (error) {
    console.error("❌ Error in bulk upload:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to bulk upload students",
      error: error.message 
    });
  }
});

// ✅ SETUP SUBJECTS Route
router.post("/setup-subjects/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { subjects } = req.body;
  
  if (!subjects || !Array.isArray(subjects) || subjects.length === 0) {
    return res.status(400).json({ 
      success: false,
      message: "Subjects array is required and must not be empty" 
    });
  }
  
  try {
    const Subject = getSubjectModel(stream, sem);
    const results = [];
    let addedCount = 0;
    
    for (const subjectName of subjects) {
      if (!subjectName || subjectName.trim().length < 2) {
        results.push({
          subjectName: subjectName,
          success: false,
          error: "Subject name must be at least 2 characters long"
        });
        continue;
      }
      
      try {
        // Check if subject already exists
        const existingSubject = await Subject.findOne({ 
          subjectName: subjectName.trim() 
        });
        
        if (existingSubject) {
          results.push({
            subjectName: subjectName.trim(),
            success: false,
            error: "Subject already exists"
          });
          continue;
        }
        
        // Create new subject
        const newSubject = new Subject({
          subjectName: subjectName.trim(),
          stream: stream.toUpperCase(),
          semester: parseInt(sem)
        });
        
        await newSubject.save();
        addedCount++;
        
        results.push({
          subjectName: subjectName.trim(),
          success: true,
          message: "Subject added successfully"
        });
        
      } catch (error) {
        results.push({
          subjectName: subjectName.trim(),
          success: false,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Subjects setup completed: ${addedCount}/${subjects.length} added for ${stream} Semester ${sem}`);
    
    res.status(200).json({
      success: true,
      message: `✅ Subjects setup completed: ${addedCount}/${subjects.length} subjects added`,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      total: subjects.length,
      added: addedCount,
      failed: subjects.length - addedCount,
      results: results
    });
    
  } catch (error) {
    console.error("❌ Error setting up subjects:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to setup subjects",
      error: error.message 
    });
  }
});

// ✅ Check if attendance already exists for the same subject and date
router.get("/check-attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ 
      exists: false, 
      message: "Date parameter is required" 
    });
  }

  try {
    const Attendance = getAttendanceModel(stream, sem, subject);
    const existingRecord = await Attendance.findOne({
      date: new Date(date),
      subject: subject
    });

    res.json({
      exists: !!existingRecord,
      date: date,
      subject: subject,
      stream: stream,
      semester: sem,
      recordId: existingRecord?._id || null,
      studentsPresent: existingRecord?.studentsPresent || [],
      recordCount: existingRecord ? 1 : 0
    });

  } catch (error) {
    console.error("❌ Error checking attendance:", error);
    res.status(500).json({ 
      exists: false, 
      message: "Failed to check attendance" 
    });
  }
});
router.get("/students/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`👥 Loading students for: ${stream} Semester ${sem}`);
    
    const Student = getStudentModel(stream, sem);
    const query = getActiveStudentQuery();
    
    const students = await Student.find(query)
      .select('studentID name parentPhone stream semester migrationGeneration originalSemester')
      .sort({ studentID: 1 });
    
    console.log(`✅ Found ${students.length} students in collection: ${Student.collection.name}`);
    
    res.json({
      success: true,
      count: students.length,
      stream: stream,
      semester: parseInt(sem),
      students: students,
      collectionUsed: Student.collection.name
    });
    
  } catch (error) {
    console.error(`❌ Error fetching students:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch students",
      error: error.message,
      stream: stream,
      semester: sem
    });
  }
});

// GET Subjects Route
router.get("/subjects/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`📚 Loading subjects for: ${stream} Semester ${sem}`);
    
    const Subject = getSubjectModel(stream, sem);
    const query = { isActive: { $ne: false } };
    
    const subjects = await Subject.find(query)
      .select('subjectName stream semester isActive')
      .sort({ subjectName: 1 });
    
    console.log(`✅ Found ${subjects.length} subjects in collection: ${Subject.collection.name}`);
    
    res.json({
      success: true,
      count: subjects.length,
      stream: stream,
      semester: parseInt(sem),
      subjects: subjects,
      collectionUsed: Subject.collection.name
    });
    
  } catch (error) {
    console.error(`❌ Error fetching subjects:`, error);
    res.status(500).json({ 
      success: false,
      message: "Failed to fetch subjects",
      error: error.message,
      stream: stream,
      semester: sem
    });
  }
});

// ✅ POST Mark Attendance (Without Immediate WhatsApp Messages - For Manual System)
router.post("/attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { date, studentsPresent, forceOverwrite } = req.body;

  if (!date || !subject || !Array.isArray(studentsPresent)) {
    return res.status(400).json({ message: "Missing required fields: date, subject, studentsPresent (array)" });
  }

  try {
    const Attendance = getAttendanceModel(stream, sem, subject);
    const Student = getStudentModel(stream, sem);
    
    if (!forceOverwrite) {
      const existingRecord = await Attendance.findOne({
        date: new Date(date),
        subject: subject
      });

      if (existingRecord) {
        return res.status(409).json({
          exists: true,
          message: "Attendance already taken for this subject and date",
          date: date,
          subject: subject,
          stream: stream,
          semester: sem,
          existingData: {
            studentsPresent: existingRecord.studentsPresent,
            recordId: existingRecord._id,
            createdAt: existingRecord.createdAt
          }
        });
      }
    }
    
    const allStudents = await Student.find(getActiveStudentQuery(), "studentID name parentPhone");
    const totalStudents = allStudents.length;

    if (totalStudents === 0) {
      return res.status(404).json({ message: "No students found for this stream and semester" });
    }

    const existingRecord = await Attendance.findOne({
      date: new Date(date),
      subject: subject
    });
    const isOverwrite = !!existingRecord;

    // ✅ Store attendance in database
    const record = await Attendance.findOneAndUpdate(
      { date: new Date(date), subject },
      { $set: { studentsPresent } },
      { upsert: true, new: true }
    );

    // ✅ Update base attendance collection
    await BaseAttendance.findOneAndUpdate(
      {
        date: new Date(date).toISOString().slice(0, 10),
        stream: stream.toUpperCase(),
        semester: Number(sem),
        subject,
      },
      {
        $set: {
          studentsPresent,
          studentsTotal: totalStudents,
        },
      },
      { upsert: true, new: true }
    );

    // ✅ Calculate absent students (for summary only - no immediate messages)
    const absentStudents = allStudents.filter(
      student => !studentsPresent.includes(student.studentID)
    );

    // ✅ Count students with/without phone numbers
    const absentWithPhone = absentStudents.filter(s => s.parentPhone).length;
    const absentWithoutPhone = absentStudents.filter(s => !s.parentPhone).length;

    console.log(`✅ Attendance marked for ${stream} Semester ${sem} - ${subject} on ${date}`);
    console.log(`   Present: ${studentsPresent.length}, Absent: ${absentStudents.length}`);
    console.log(`   Absent with phone: ${absentWithPhone}, Absent without phone: ${absentWithoutPhone}`);

    // ✅ No immediate WhatsApp messages - data stored for manual messaging
    res.status(200).json({ 
      message: `✅ Attendance ${isOverwrite ? 'updated' : 'marked'} successfully. Use manual messaging system to send WhatsApp notifications.`, 
      data: record,
      isOverwrite,
      summary: {
        totalStudents,
        presentStudents: studentsPresent.length,
        absentStudents: absentStudents.length,
        absentWithPhone: absentWithPhone,
        absentWithoutPhone: absentWithoutPhone,
        // ✅ List of absent students for immediate feedback
        absentStudentsList: absentStudents.map(s => ({
          studentID: s.studentID,
          name: s.name,
          hasPhone: !!s.parentPhone,
          parentPhone: s.parentPhone ? 'Available' : 'Not Available'
        }))
      },
      // ✅ Manual messaging info
      manualMessaging: {
        enabled: true,
        note: "Attendance data stored. Use manual messaging system to send consolidated WhatsApp messages.",
        nextSteps: [
          "Go to Manual Messaging System",
          `Select ${stream} - Semester ${sem}`,
          `Set date to ${new Date(date).toLocaleDateString('en-IN')}`,
          "Click 'Send Messages Now' when ready"
        ]
      }
    });

  } catch (error) {
    console.error("❌ Error marking attendance:", error);
    res.status(500).json({ message: "Failed to mark attendance." });
  }
});

// ✅ ENHANCED: Manual Send Consolidated WhatsApp Messages (with duplicate prevention)
router.post("/send-absence-messages/:stream/sem:sem/:date", validateParams, async (req, res) => {
  const { stream, sem, date } = req.params;
  const { forceResend = false } = req.body;
  
  try {
    console.log(`📱 Manual messaging triggered for ${stream} Semester ${sem} on ${date}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const MessageLog = getMessageLogModel();
    
    const dateKey = new Date(date).toISOString().slice(0, 10);
    
    // ✅ Check if messages already sent today (unless forceResend is true)
    if (!forceResend) {
      const existingLog = await MessageLog.findOne({
        date: dateKey,
        stream: stream.toUpperCase(),
        semester: parseInt(sem)
      });
      
      if (existingLog && existingLog.messagesSent > 0) {
        const formatDate = new Date(date).toLocaleDateString('en-IN', {
          day: '2-digit',
          month: '2-digit', 
          year: 'numeric'
        });
        
        return res.status(200).json({
          success: true,
          alreadySent: true,
          message: `📱 Messages already sent today for ${stream} Semester ${sem} on ${formatDate}`,
          previousSendInfo: {
            date: formatDate,
            stream: stream.toUpperCase(),
            semester: sem,
            messagesSent: existingLog.messagesSent,
            messagesFailed: existingLog.messagesFailed,
            totalStudentsNotified: existingLog.totalStudentsNotified,
            sentAt: existingLog.sentAt,
            subjectsIncluded: existingLog.subjectsIncluded,
            sentBy: existingLog.sentBy
          },
          note: "Messages have already been sent for this date. Use 'forceResend: true' in request body to send messages again.",
          summary: {
            totalStudents: 0,
            subjectsWithAttendance: existingLog.subjectsIncluded.length,
            studentsToNotify: 0,
            messagesSent: 0,
            messagesFailed: 0,
            fullDayAbsent: 0,
            partialDayAbsent: 0,
            alreadyProcessed: true
          }
        });
      }
    }
    
    const allStudents = await Student.find(getActiveStudentQuery(), "studentID name parentPhone");
    const allSubjects = await Subject.find();
    
    if (allStudents.length === 0 || allSubjects.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "No students or subjects found for this stream and semester" 
      });
    }
    
    // Get attendance for all subjects on this date
    const attendancePromises = allSubjects.map(async (subject) => {
      try {
        const Attendance = getAttendanceModel(stream, sem, subject.subjectName);
        const record = await Attendance.findOne({ date: new Date(date) });
        return {
          subject: subject.subjectName,
          studentsPresent: record ? record.studentsPresent : [],
          hasAttendance: !!record
        };
      } catch (error) {
        return {
          subject: subject.subjectName,
          studentsPresent: [],
          hasAttendance: false
        };
      }
    });
    
    const allAttendanceRecords = await Promise.all(attendancePromises);
    const subjectsWithAttendance = allAttendanceRecords.filter(r => r.hasAttendance);
    
    if (subjectsWithAttendance.length === 0) {
      return res.status(400).json({
        success: false,
        message: `No attendance records found for ${date}. Please mark attendance first.`
      });
    }
    
    // Calculate absence for each student
    const studentsToNotify = [];
    
    allStudents.forEach(student => {
      const absentSubjects = [];
      
      subjectsWithAttendance.forEach(record => {
        if (!record.studentsPresent.includes(student.studentID)) {
          absentSubjects.push(record.subject);
        }
      });
      
      if (absentSubjects.length > 0 && student.parentPhone) {
        const isFullDayAbsent = absentSubjects.length === subjectsWithAttendance.length;
        
        studentsToNotify.push({
          student: student,
          absentSubjects: absentSubjects,
          isFullDayAbsent: isFullDayAbsent,
          messageType: isFullDayAbsent ? 'full_day' : 'partial_day'
        });
      }
    });
    
    if (studentsToNotify.length === 0) {
      // ✅ Log that no messages were needed
      await MessageLog.findOneAndUpdate(
        {
          date: dateKey,
          stream: stream.toUpperCase(),
          semester: parseInt(sem)
        },
        {
          messagesSent: 0,
          messagesFailed: 0,
          totalStudentsNotified: 0,
          fullDayAbsentCount: 0,
          partialDayAbsentCount: 0,
          subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
          sentAt: new Date(),
          sentBy: forceResend ? 'manual-force' : 'manual'
        },
        { upsert: true, new: true }
      );
      
      return res.status(200).json({
        success: true,
        message: `No students with absences found for ${date}. All students were present!`,
        summary: {
          totalStudents: allStudents.length,
          subjectsWithAttendance: subjectsWithAttendance.length,
          studentsToNotify: 0,
          messagesSent: 0
        }
      });
    }
    
    // Send consolidated messages
    const whatsappResults = [];
    const formatDate = new Date(date).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
    
    console.log(`📱 Sending messages to ${studentsToNotify.length} students`);
    
    for (const notificationData of studentsToNotify) {
      const { student, absentSubjects, isFullDayAbsent } = notificationData;
      
      try {
        let message;
        
        if (isFullDayAbsent) {
          message = `Dear Parent,

Your child ${student.name} (${student.studentID}) was ABSENT for the WHOLE DAY on ${formatDate}.

Stream: ${stream.toUpperCase()}
Semester: ${sem}
Total Subjects: ${absentSubjects.length}

Please contact the school if this is incorrect.

Best regards,
School Administration`;
        } else {
          message = `Dear Parent,

Your child ${student.name} (${student.studentID}) was ABSENT for the following subject(s) on ${formatDate}:

${absentSubjects.map((subj, index) => `${index + 1}. ${subj}`).join('\n')}

Stream: ${stream.toUpperCase()}
Semester: ${sem}

Please contact the school if this is incorrect.

Best regards,
School Administration`;
        }

        const result = await sendWhatsAppMessage(student.parentPhone, message);
        
        whatsappResults.push({
          studentID: student.studentID,
          studentName: student.name,
          parentPhone: student.parentPhone,
          success: result.success,
          messageId: result.messageId || null,
          error: result.error || null,
          messageType: isFullDayAbsent ? 'full_day' : 'partial_day',
          absentSubjects: absentSubjects,
          subjectCount: absentSubjects.length
        });

        // Delay between messages
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ WhatsApp error for ${student.studentID}:`, error);
        whatsappResults.push({
          studentID: student.studentID,
          studentName: student.name,
          success: false,
          error: error.message,
          messageType: isFullDayAbsent ? 'full_day' : 'partial_day',
          absentSubjects: absentSubjects
        });
      }
    }
    
    const successCount = whatsappResults.filter(r => r.success).length;
    const fullDayCount = whatsappResults.filter(r => r.messageType === 'full_day' && r.success).length;
    const partialDayCount = whatsappResults.filter(r => r.messageType === 'partial_day' && r.success).length;
    
    // ✅ Log the message sending activity
    await MessageLog.findOneAndUpdate(
      {
        date: dateKey,
        stream: stream.toUpperCase(),
        semester: parseInt(sem)
      },
      {
        messagesSent: successCount,
        messagesFailed: whatsappResults.length - successCount,
        totalStudentsNotified: studentsToNotify.length,
        fullDayAbsentCount: fullDayCount,
        partialDayAbsentCount: partialDayCount,
        subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
        sentAt: new Date(),
        sentBy: forceResend ? 'manual-force' : 'manual',
        whatsappResults: whatsappResults.map(r => ({
          studentID: r.studentID,
          studentName: r.studentName,
          success: r.success,
          messageType: r.messageType,
          error: r.error
        }))
      },
      { upsert: true, new: true }
    );
    
    console.log(`✅ Manual messaging completed: ${successCount}/${whatsappResults.length} messages sent`);
    
    res.json({
      success: true,
      message: `✅ Consolidated absence messages sent successfully!`,
      date: formatDate,
      stream: stream.toUpperCase(),
      semester: sem,
      summary: {
        totalStudents: allStudents.length,
        subjectsWithAttendance: subjectsWithAttendance.length,
        studentsToNotify: studentsToNotify.length,
        messagesSent: successCount,
        messagesFailed: whatsappResults.length - successCount,
        fullDayAbsent: fullDayCount,
        partialDayAbsent: partialDayCount,
        isForceResend: forceResend
      },
      subjectsIncluded: subjectsWithAttendance.map(s => s.subject),
      whatsappResults: whatsappResults,
      triggeredAt: new Date().toISOString(),
      triggerType: forceResend ? 'manual-force' : 'manual'
    });
    
  } catch (error) {
    console.error("❌ Error in manual messaging:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send messages",
      error: error.message
    });
  }
});

// ✅ ENHANCED: GET Daily Absence Summary (with sent message status)
router.get("/daily-absence-summary/:stream/sem:sem/:date", validateParams, async (req, res) => {
  const { stream, sem, date } = req.params;
  
  try {
    console.log(`📊 Getting daily absence summary for ${stream} Semester ${sem} on ${date}`);
    
    const Student = getStudentModel(stream, sem);
    const Subject = getSubjectModel(stream, sem);
    const MessageLog = getMessageLogModel();
    
    const dateKey = new Date(date).toISOString().slice(0, 10);
    
    // ✅ Check if messages already sent for this date
    const messageLog = await MessageLog.findOne({
      date: dateKey,
      stream: stream.toUpperCase(),
      semester: parseInt(sem)
    });
    
    const allStudents = await Student.find(getActiveStudentQuery(), "studentID name parentPhone");
    const allSubjects = await Subject.find();
    
    if (allStudents.length === 0 || allSubjects.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: "No students or subjects found for this stream and semester" 
      });
    }
    
    // Get attendance for all subjects on this date
    const attendancePromises = allSubjects.map(async (subject) => {
      try {
        const Attendance = getAttendanceModel(stream, sem, subject.subjectName);
        const record = await Attendance.findOne({ date: new Date(date) });
        return {
          subject: subject.subjectName,
          studentsPresent: record ? record.studentsPresent : [],
          hasAttendance: !!record
        };
      } catch (error) {
        return {
          subject: subject.subjectName,
          studentsPresent: [],
          hasAttendance: false
        };
      }
    });
    
    const allAttendanceRecords = await Promise.all(attendancePromises);
    const subjectsWithAttendance = allAttendanceRecords.filter(r => r.hasAttendance);
    
    // Calculate absence summary for each student
    const absenceSummary = allStudents.map(student => {
      const absentSubjects = [];
      
      subjectsWithAttendance.forEach(record => {
        if (!record.studentsPresent.includes(student.studentID)) {
          absentSubjects.push(record.subject);
        }
      });
      
      const isFullDayAbsent = absentSubjects.length === subjectsWithAttendance.length && subjectsWithAttendance.length > 0;
      
      return {
        studentID: student.studentID,
        studentName: student.name,
        parentPhone: student.parentPhone,
        absentSubjects: absentSubjects,
        absentSubjectCount: absentSubjects.length,
        totalSubjectsWithAttendance: subjectsWithAttendance.length,
        isFullDayAbsent: isFullDayAbsent,
        messageType: isFullDayAbsent ? 'full_day' : absentSubjects.length > 0 ? 'partial_day' : 'present',
        willReceiveMessage: absentSubjects.length > 0 && student.parentPhone
      };
    });
    
    const studentsToNotify = absenceSummary.filter(s => s.absentSubjectCount > 0);
    const fullDayAbsent = studentsToNotify.filter(s => s.isFullDayAbsent);
    const partialDayAbsent = studentsToNotify.filter(s => !s.isFullDayAbsent);
    
    // ✅ Enhanced response with message sending status
    const response = {
      success: true,
      date: new Date(date).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      }),
      stream: stream.toUpperCase(),
      semester: sem,
      summary: {
        totalStudents: allStudents.length,
        totalSubjects: allSubjects.length,
        subjectsWithAttendance: subjectsWithAttendance.length,
        studentsToNotify: studentsToNotify.length,
        fullDayAbsent: fullDayAbsent.length,
        partialDayAbsent: partialDayAbsent.length,
        studentsPresent: allStudents.length - studentsToNotify.length
      },
      absenceSummary: absenceSummary,
      subjects: allSubjects.map(s => s.subjectName),
      subjectsWithAttendance: subjectsWithAttendance.map(s => s.subject),
      consolidatedMessaging: {
        totalMessagesToSend: studentsToNotify.filter(s => s.parentPhone).length,
        fullDayMessages: fullDayAbsent.filter(s => s.parentPhone).length,
        partialDayMessages: partialDayAbsent.filter(s => s.parentPhone).length
      }
    };
    
    // ✅ Add message sending status
    if (messageLog && messageLog.messagesSent > 0) {
      response.messageStatus = {
        alreadySent: true,
        sentAt: messageLog.sentAt,
        messagesSent: messageLog.messagesSent,
        messagesFailed: messageLog.messagesFailed,
        totalStudentsNotified: messageLog.totalStudentsNotified,
        fullDayAbsentCount: messageLog.fullDayAbsentCount,
        partialDayAbsentCount: messageLog.partialDayAbsentCount,
        sentBy: messageLog.sentBy,
        subjectsIncluded: messageLog.subjectsIncluded,
        note: "Messages have already been sent for this date. Use 'forceResend: true' to send again."
      };
    } else {
      response.messageStatus = {
        alreadySent: false,
        note: "No messages sent yet for this date. Ready to send messages."
      };
    }
    
    res.json(response);
    
  } catch (error) {
    console.error("❌ Error getting daily absence summary:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get daily absence summary",
      error: error.message
    });
  }
});

// ✅ NEW: Get message sending history
router.get("/message-history/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  const { limit = 10, page = 1 } = req.query;
  
  try {
    const MessageLog = getMessageLogModel();
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const history = await MessageLog.find({
      stream: stream.toUpperCase(),
      semester: parseInt(sem)
    })
    .sort({ date: -1, sentAt: -1 })
    .skip(skip)
    .limit(parseInt(limit));
    
    const total = await MessageLog.countDocuments({
      stream: stream.toUpperCase(),
      semester: parseInt(sem)
    });
    
    res.json({
      success: true,
      stream: stream.toUpperCase(),
      semester: sem,
      history: history.map(log => ({
        date: log.date,
        sentAt: log.sentAt,
        messagesSent: log.messagesSent,
        messagesFailed: log.messagesFailed,
        totalStudentsNotified: log.totalStudentsNotified,
        fullDayAbsentCount: log.fullDayAbsentCount,
        partialDayAbsentCount: log.partialDayAbsentCount,
        subjectsIncluded: log.subjectsIncluded,
        sentBy: log.sentBy
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
    
  } catch (error) {
    console.error("❌ Error getting message history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get message history",
      error: error.message
    });
  }
});

// ✅ NEW: Force resend messages (bypass duplicate prevention)
router.post("/force-resend-messages/:stream/sem:sem/:date", validateParams, async (req, res) => {
  req.body.forceResend = true;
  
  // Redirect to the main send messages route with forceResend enabled
  return router.handle({
    ...req,
    url: req.url.replace('/force-resend-messages/', '/send-absence-messages/'),
    method: 'POST'
  }, res);
});

// ✅ GET Attendance Register
router.get("/attendance-register/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;

  try {
    const Student = getStudentModel(stream, sem);
    const Attendance = getAttendanceModel(stream, sem, subject);

    const students = await Student.find(getActiveStudentQuery(), "studentID name migrationGeneration");
    const attendanceRecords = await Attendance.find().sort({ date: 1 });

    if (students.length === 0) {
      return res.status(404).json({ message: "No students found for this stream and semester" });
    }

    const attendanceMap = {};
    attendanceRecords.forEach(record => {
      const dateKey = new Date(record.date).toISOString().split("T")[0];
      attendanceMap[dateKey] = record.studentsPresent;
    });

    res.json({ 
      students, 
      attendanceMap, 
      subject, 
      stream: stream.toUpperCase(), 
      semester: sem 
    });
  } catch (error) {
    console.error("❌ Error fetching attendance register:", error);
    res.status(500).json({ message: "Failed to fetch attendance register" });
  }
});

// ✅ POST Bulk Attendance Update
router.post("/update-attendance/:stream/sem:sem/:subject", validateParams, async (req, res) => {
  const { stream, sem, subject } = req.params;
  const { attendanceMap } = req.body;

  if (!attendanceMap || typeof attendanceMap !== "object") {
    return res.status(400).json({ message: "Invalid attendance data. Expected object." });
  }

  try {
    const Attendance = getAttendanceModel(stream, sem, subject);
    const dates = Object.keys(attendanceMap);

    if (dates.length === 0) {
      return res.status(400).json({ message: "No attendance data provided" });
    }

    const updatePromises = dates.map(async (date) => {
      const studentsPresent = attendanceMap[date];
      
      if (!Array.isArray(studentsPresent)) {
        throw new Error(`Invalid data for date ${date}. Expected array.`);
      }

      return await Attendance.findOneAndUpdate(
        { date: new Date(date), subject },
        { $set: { studentsPresent } },
        { upsert: true, new: true }
      );
    });

    await Promise.all(updatePromises);

    res.json({ 
      message: "✅ Attendance updated successfully",
      updatedDates: dates.length 
    });
  } catch (error) {
    console.error("❌ Server error while updating attendance:", error);
    res.status(500).json({ message: "Server error while updating attendance" });
  }
});
// Debug route to test exact mapping
router.get("/debug/test-bcom-mapping", async (req, res) => {
  const stream = "BCom A and F";
  const semester = "5";
  
  try {
    // Test the mapping
    const studentCollection = getCollectionName(stream, semester, "students");
    const subjectCollection = getCollectionName(stream, semester, "subjects");
    
    // Test direct access to your collection
    const StudentModel = mongoose.model('TestBComStudents', studentSchema, 'bcom_a_and_f_sem5_students');
    const count = await StudentModel.countDocuments();
    const sample = await StudentModel.findOne();
    
    res.json({
      mapping: {
        input: { stream, semester },
        output: {
          students: studentCollection,
          subjects: subjectCollection
        },
        expected: "bcom_a_and_f_sem5_students"
      },
      directAccess: {
        collectionName: "bcom_a_and_f_sem5_students",
        documentCount: count,
        sampleStudent: sample ? {
          studentID: sample.studentID,
          name: sample.name,
          isActive: sample.isActive
        } : null
      },
      mappingCorrect: studentCollection === "bcom_a_and_f_sem5_students"
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get("/reports/student-subject-report/:stream/sem:sem", validateParams, async (req, res) => {
  const { stream, sem } = req.params;
  
  try {
    console.log(`📊 Generating report for: ${stream} Semester ${sem}`);
    
    let studentCollectionName, subjectCollectionName;
    
    // Handle BCom A and F specifically
    if (stream === "BCom A and F" && sem === "5") {
      studentCollectionName = "bcom_a_and_f_sem5_students";
      subjectCollectionName = "bcom_a_and_f_sem5_subjects";
      console.log(`🎯 Using exact collection names for BCom A and F`);
    } else {
      // Use mapping function for other streams
      studentCollectionName = getCollectionName(stream, sem, "students");
      subjectCollectionName = getCollectionName(stream, sem, "subjects");
    }
    
    console.log(`🗂️  Collections: ${studentCollectionName}, ${subjectCollectionName}`);
    
    // Create models with exact collection names
    const StudentModel = mongoose.models[studentCollectionName] || 
      mongoose.model(studentCollectionName, studentSchema, studentCollectionName);
    const SubjectModel = mongoose.models[subjectCollectionName] || 
      mongoose.model(subjectCollectionName, subjectSchema, subjectCollectionName);
    
    // Fetch data
    const students = await StudentModel.find({ isActive: true }).lean();
    const subjects = await SubjectModel.find().lean();
    
    console.log(`✅ Found ${students.length} students and ${subjects.length} subjects`);
    
    if (students.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: `No students found in collection: ${studentCollectionName}` 
      });
    }
    
    // Build report data
    const reportData = {
      success: true,
      stream: stream.toUpperCase(),
      semester: parseInt(sem),
      reportDate: new Date().toLocaleDateString('en-IN'),
      totalStudents: students.length,
      totalSubjects: subjects.length,
      subjects: subjects.map(s => s.subjectName),
      students: students.map(student => ({
        studentID: student.studentID,
        name: student.name,
        subjects: subjects.reduce((acc, subject) => {
          // Mock percentage for now - replace with actual attendance calculation
          acc[subject.subjectName] = {
            attended: Math.floor(Math.random() * 20) + 15,
            total: 30,
            percentage: Math.floor(Math.random() * 25) + 75 // 75-100%
          };
          return acc;
        }, {})
      }))
    };
    
    console.log(`🎉 Report generated successfully!`);
    res.json(reportData);
    
  } catch (error) {
    console.error(`❌ Report error:`, error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to generate report",
      error: error.message 
    });
  }
});

module.exports = router;
