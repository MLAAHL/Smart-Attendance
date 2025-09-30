// routes/updateRoute.js - FIXED PRODUCTION VERSION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const asyncHandler = require('express-async-handler');

// ===== STREAMS CONFIGURATION WITH REAL COLLECTION PREFIXES =====
const STREAMS_CONFIG = [
    { name: 'BCA',             semesters: [1,2,3,4,5,6], collectionPrefix: 'bca' },
    { name: 'BCA AI & ML',     semesters: [1,2,3,4,5,6], collectionPrefix: 'bcaaiandml' },
    { name: 'BBA',             semesters: [1,2,3,4,5,6], collectionPrefix: 'bba' },
    { name: 'BCOM',            semesters: [1,2,3,4,5,6], collectionPrefix: 'bcom' },
    { name: 'BCOM SECTION B',  semesters: [1,2,3,4,5,6], collectionPrefix: 'bcomsectionb' },
    { name: 'BCOM SECTION C',  semesters: [1,2,3,4,5,6], collectionPrefix: 'bcomsectionc' },
    { name: 'BCOM-BDA',        semesters: [1,2,3,4,5,6], collectionPrefix: 'bcom-bda' },
    { name: 'BCOM A AND F',    semesters: [1,2,3,4,5,6], collectionPrefix: 'bcom_a_and_f' }
];

// Create fast lookup mapping
const STREAM_COLLECTION_MAP = STREAMS_CONFIG.reduce((map, stream) => {
    map[stream.name] = stream.collectionPrefix;
    return map;
}, {});

// Model cache to prevent duplicate models
const modelCache = new Map();

// ===== HELPER FUNCTIONS =====

// Get exact collection name using real prefixes
function getCollectionName(stream, semester, type = 'students') {
    const collectionPrefix = STREAM_COLLECTION_MAP[stream];
    if (!collectionPrefix) {
        throw new Error(`Unknown stream: ${stream}. Available: ${Object.keys(STREAM_COLLECTION_MAP).join(', ')}`);
    }
    return `${collectionPrefix}_sem${semester}_${type}`;
}

// Get stream configuration
function getStreamConfig(streamName) {
    return STREAMS_CONFIG.find(s => s.name === streamName);
}

// Validate stream and semester
function validateStreamAndSemester(stream, semester) {
    const streamConfig = getStreamConfig(stream);
    if (!streamConfig) {
        return { valid: false, error: `Invalid stream: ${stream}` };
    }

    if (!streamConfig.semesters.includes(parseInt(semester))) {
        return { 
            valid: false, 
            error: `Stream ${stream} does not support semester ${semester}. Available: ${streamConfig.semesters.join(', ')}` 
        };
    }

    return { valid: true };
}

// ===== DYNAMIC MODEL CREATION =====

function getStudentModel(stream, semester) {
    const collectionName = getCollectionName(stream, semester, 'students');

    // Check cache first
    if (modelCache.has(collectionName)) {
        return modelCache.get(collectionName);
    }

    // Check if model already exists in mongoose
    if (mongoose.models[collectionName]) {
        modelCache.set(collectionName, mongoose.models[collectionName]);
        return mongoose.models[collectionName];
    }

    // Create new schema matching your real data structure
    const studentSchema = new mongoose.Schema({
        studentID: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true
        },
        name: {
            type: String,
            required: true,
            trim: true,
            maxLength: 100,
            index: true
        },
        stream: {
            type: String,
            required: true,
            enum: STREAMS_CONFIG.map(s => s.name),
            index: true
        },
        semester: {
            type: Number,
            required: true,
            min: 1,
            max: 6,
            index: true
        },
        parentPhone: {
            type: String,
            default: null,
            sparse: true
        },
        languageSubject: {
            type: String,
            enum: ['KANNADA', 'HINDI', 'SANSKRIT', 'TAMIL', null],
            default: null
        },
        // Additional fields from your real data
        languageGroup: {
            type: String,
            default: null
        },
        migrationGeneration: {
            type: Number,
            default: 0
        },
        originalSemester: {
            type: Number,
            default: function() { return this.semester; }
        },
        addedToSemesterDate: {
            type: Date,
            default: Date.now
        },
        academicYear: {
            type: Number,
            default: function() { return new Date().getFullYear(); },
            index: true
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        // System metadata
        collectionSource: {
            type: String,
            default: collectionName
        }
    }, {
        timestamps: true,
        collection: collectionName,
        // Add compound indexes for better performance
        indexes: [
            { studentID: 1 },
            { name: 1 },
            { stream: 1, semester: 1 },
            { isActive: 1, academicYear: 1 },
            { stream: 1, semester: 1, isActive: 1 }
        ]
    });

    // Ensure unique constraint on studentID within each collection
    studentSchema.index({ studentID: 1 }, { unique: true });

    const model = mongoose.model(collectionName, studentSchema);
    modelCache.set(collectionName, model);

    console.log(`✅ Created model for collection: ${collectionName}`);
    return model;
}

function getSubjectModel(stream, semester) {
    const collectionName = getCollectionName(stream, semester, 'subjects');

    // Check cache first
    if (modelCache.has(collectionName)) {
        return modelCache.get(collectionName);
    }

    // Check if model already exists in mongoose
    if (mongoose.models[collectionName]) {
        modelCache.set(collectionName, mongoose.models[collectionName]);
        return mongoose.models[collectionName];
    }

    // Create schema matching your real subject data
    const subjectSchema = new mongoose.Schema({
        subjectName: {
            type: String,
            required: true,
            uppercase: true,
            trim: true,
            index: true
        },
        subjectCode: {
            type: String,
            uppercase: true,
            default: function() {
                // Auto-generate if not provided
                const streamCode = this.stream?.replace(/[^A-Z]/g, '').substring(0, 3) || 'GEN';
                const nameCode = this.subjectName?.substring(0, 3) || 'SUB';
                return `${streamCode}${this.semester}${nameCode}`;
            },
            index: true
        },
        stream: {
            type: String,
            required: true,
            enum: STREAMS_CONFIG.map(s => s.name),
            index: true
        },
        semester: {
            type: Number,
            required: true,
            min: 1,
            max: 6,
            index: true
        },
        subjectType: {
            type: String,
            enum: ['CORE', 'ELECTIVE', 'LANGUAGE', 'PRACTICAL', 'PROJECT'],
            default: 'CORE',
            index: true
        },
        isLanguageSubject: {
            type: Boolean,
            default: false,
            index: true
        },
        languageType: {
            type: String,
            enum: ['KANNADA', 'HINDI', 'SANSKRIT', 'TAMIL', null],
            default: null
        },
        credits: {
            type: Number,
            default: 4,
            min: 1,
            max: 6
        },
        description: {
            type: String,
            default: ''
        },
        isActive: {
            type: Boolean,
            default: true,
            index: true
        },
        // System metadata
        collectionSource: {
            type: String,
            default: collectionName
        }
    }, {
        timestamps: true,
        collection: collectionName,
        // Add compound indexes
        indexes: [
            { subjectName: 1 },
            { subjectCode: 1 },
            { stream: 1, semester: 1 },
            { subjectType: 1, isActive: 1 }
        ]
    });

    // Ensure unique constraint on subjectName within each collection
    subjectSchema.index({ subjectName: 1 }, { unique: true });

    const model = mongoose.model(collectionName, subjectSchema);
    modelCache.set(collectionName, model);

    console.log(`✅ Created model for collection: ${collectionName}`);
    return model;
}

// ===== STUDENT ROUTES =====

// CREATE STUDENT
router.post('/students/:stream/sem:sem', validateParams, asyncHandler(async (req, res) => {
    const { stream, sem } = req.params;
    const { 
        studentID, 
        name, 
        parentPhone, 
        languageSubject, 
        languageGroup,
        academicYear,
        isActive 
    } = req.body;

    console.log(`📝 Creating student in ${stream} Sem ${sem}:`, {
        studentID,
        name,
        targetCollection: getCollectionName(stream, sem, 'students')
    });

    try {
        // Enhanced validation
        if (!studentID || !name) {
            return res.status(400).json({
                success: false,
                message: "Student ID and name are required",
                required: ["studentID", "name"]
            });
        }

        // Validate studentID format
        const studentIdRegex = /^[A-Z0-9-_]+$/;
        if (!studentIdRegex.test(studentID.toUpperCase())) {
            return res.status(400).json({
                success: false,
                message: "Student ID can only contain letters, numbers, hyphens and underscores"
            });
        }

        const Student = getStudentModel(stream, sem);
        const collectionName = getCollectionName(stream, sem, 'students');

        // Check for existing student
        const existingStudent = await Student.findOne({ studentID: studentID.toUpperCase() });
        if (existingStudent) {
            return res.status(409).json({
                success: false,
                message: `Student "${studentID}" already exists in ${collectionName}`,
                existingStudent: {
                    id: existingStudent._id,
                    name: existingStudent.name
                }
            });
        }

        // Create student data with proper defaults
        const studentData = {
            studentID: studentID.toUpperCase().trim(),
            name: name.trim(),
            stream: stream,
            semester: parseInt(sem),
            parentPhone: parentPhone?.trim() || null,
            languageSubject: languageSubject || null,
            languageGroup: languageGroup || (languageSubject ? `${languageSubject}_GROUP` : null),
            academicYear: parseInt(academicYear) || new Date().getFullYear(),
            isActive: isActive !== false,
            originalSemester: parseInt(sem),
            addedToSemesterDate: new Date(),
            migrationGeneration: 0
        };

        const newStudent = new Student(studentData);
        await newStudent.save();

        console.log(`✅ Student created successfully: ${newStudent.studentID} in ${collectionName}`);

        res.status(201).json({
            success: true,
            message: `Student "${name}" created successfully`,
            student: newStudent,
            collectionUsed: collectionName,
            streamMapping: STREAM_COLLECTION_MAP[stream]
        });

    } catch (error) {
        console.error('❌ Error creating student:', error);

        if (error.code === 11000) {
            // Duplicate key error
            const duplicateField = Object.keys(error.keyPattern || {})[0] || 'studentID';
            return res.status(409).json({
                success: false,
                message: `${duplicateField} already exists`,
                error: "Duplicate key error",
                field: duplicateField
            });
        }

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create student",
            error: error.message,
            collection: getCollectionName(stream, sem, 'students')
        });
    }
}));

// GET ALL STUDENTS - ENHANCED WITH BETTER ERROR HANDLING
router.get('/students/all', asyncHandler(async (req, res) => {
    try {
        const { 
            stream, 
            semester, 
            isActive = 'true', 
            page = 1, 
            limit = 5000,
            search = '',
            sortBy = 'name',
            sortOrder = 'asc',
            academicYear
        } = req.query;

        console.log(`🔍 Loading students - Stream: ${stream || 'ALL'}, Semester: ${semester || 'ALL'}`);

        const allStudents = [];
        let collectionsScanned = [];
        let collectionsWithData = [];
        let totalCollectionsAttempted = 0;
        let errors = [];

        // Determine which streams to search
        const streamsToSearch = stream ? 
            STREAMS_CONFIG.filter(s => s.name === stream) : 
            STREAMS_CONFIG;

        // Determine which semesters to search  
        const semestersToSearch = semester && !isNaN(parseInt(semester)) ? 
            [parseInt(semester)] : 
            [1,2,3,4,5,6];

        console.log(`📊 Searching across ${streamsToSearch.length} streams and ${semestersToSearch.length} semesters`);

        // Search through all collections
        for (const streamConfig of streamsToSearch) {
            for (const sem of semestersToSearch) {
                // Skip if stream doesn't have this semester
                if (!streamConfig.semesters.includes(sem)) continue;

                totalCollectionsAttempted++;

                try {
                    const Student = getStudentModel(streamConfig.name, sem);
                    const collectionName = getCollectionName(streamConfig.name, sem, 'students');
                    collectionsScanned.push(collectionName);

                    // Build query with proper type handling
                    let query = {};

                    // Active/Inactive filter
                    if (isActive !== 'all') {
                        query.isActive = isActive === 'true';
                    }

                    // Academic year filter with proper type conversion
                    if (academicYear && !isNaN(parseInt(academicYear))) {
                        query.academicYear = parseInt(academicYear);
                    }

                    // Enhanced search filter
                    if (search && search.trim()) {
                        const searchRegex = new RegExp(search.trim(), 'i');
                        query.$or = [
                            { name: searchRegex },
                            { studentID: searchRegex },
                            { parentPhone: searchRegex },
                            { languageSubject: searchRegex }
                        ];
                    }

                    // Execute query with timeout
                    const students = await Student.find(query)
                        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
                        .maxTimeMS(30000) // 30 second timeout
                        .lean();

                    if (students.length > 0) {
                        collectionsWithData.push({
                            collection: collectionName,
                            count: students.length,
                            stream: streamConfig.name,
                            semester: sem,
                            prefix: streamConfig.collectionPrefix
                        });

                        console.log(`📚 Found ${students.length} students in ${collectionName}`);
                    }

                    // Add metadata to each student
                    const studentsWithMetadata = students.map(student => ({
                        ...student,
                        _collection: collectionName,
                        _streamMapping: streamConfig.collectionPrefix,
                        _streamName: streamConfig.name
                    }));

                    allStudents.push(...studentsWithMetadata);

                } catch (err) {
                    const errorMsg = `Failed to fetch from ${streamConfig.name} sem ${sem}: ${err.message}`;
                    console.warn(`⚠️ ${errorMsg}`);
                    errors.push({
                        collection: getCollectionName(streamConfig.name, sem, 'students'),
                        stream: streamConfig.name,
                        semester: sem,
                        error: err.message
                    });
                    continue;
                }
            }
        }

        // Sort all students by specified field
        if (allStudents.length > 0) {
            allStudents.sort((a, b) => {
                let aValue = a[sortBy];
                let bValue = b[sortBy];

                // Handle null/undefined values
                if (aValue == null) aValue = '';
                if (bValue == null) bValue = '';

                // Convert to string for comparison if needed
                if (typeof aValue === 'string') {
                    aValue = aValue.toLowerCase();
                    bValue = bValue.toString().toLowerCase();
                }

                return sortOrder === 'asc' ? 
                    (aValue > bValue ? 1 : -1) : 
                    (aValue < bValue ? 1 : -1);
            });
        }

        // Apply pagination with bounds checking
        const totalStudents = allStudents.length;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(10000, Math.max(1, parseInt(limit))); // Cap at 10k for performance
        const startIndex = (pageNum - 1) * limitNum;
        const endIndex = Math.min(startIndex + limitNum, totalStudents);
        const paginatedStudents = allStudents.slice(startIndex, endIndex);

        console.log(`✅ TOTAL: Found ${totalStudents} students across ${collectionsWithData.length} collections`);

        res.json({
            success: true,
            count: paginatedStudents.length,
            total: totalStudents,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(totalStudents / limitNum),
            students: paginatedStudents,
            metadata: {
                collectionsScanned: collectionsScanned,
                collectionsWithData: collectionsWithData,
                totalCollectionsAttempted: totalCollectionsAttempted,
                streamMappings: STREAM_COLLECTION_MAP,
                errors: errors,
                searchParams: {
                    stream: stream || 'ALL',
                    semester: semester || 'ALL',
                    isActive,
                    search: search || '',
                    academicYear,
                    sortBy,
                    sortOrder
                },
                queryTime: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Error loading students:', error);
        res.status(500).json({
            success: false,
            message: "Failed to load students from collections",
            error: error.message,
            streamMappings: STREAM_COLLECTION_MAP,
            timestamp: new Date().toISOString()
        });
    }
}));

// UPDATE STUDENT - ENHANCED WITH VALIDATION
router.put('/students/:studentId', asyncHandler(async (req, res) => {
    const { studentId } = req.params;
    const updates = req.body;

    console.log(`🔄 Updating student: ${studentId}`);

    try {
        // Validate updates
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No updates provided"
            });
        }

        // Remove system fields that shouldn't be updated directly
        const systemFields = ['_id', '__v', 'createdAt', 'updatedAt', '_collection', '_streamMapping', '_streamName'];
        systemFields.forEach(field => delete updates[field]);

        // Validate specific fields
        if (updates.semester && (!Number.isInteger(updates.semester) || updates.semester < 1 || updates.semester > 6)) {
            return res.status(400).json({
                success: false,
                message: "Semester must be a number between 1 and 6"
            });
        }

        if (updates.academicYear && (!Number.isInteger(updates.academicYear) || updates.academicYear < 2000 || updates.academicYear > 2100)) {
            return res.status(400).json({
                success: false,
                message: "Academic year must be a valid year"
            });
        }

        let student = null;
        let Student = null;
        let usedCollection = null;
        let searchedCollections = [];

        // Search across all collections to find the student
        for (const streamConfig of STREAMS_CONFIG) {
            for (const sem of streamConfig.semesters) {
                try {
                    const TempStudent = getStudentModel(streamConfig.name, sem);
                    const collectionName = getCollectionName(streamConfig.name, sem, 'students');
                    searchedCollections.push(collectionName);

                    const foundStudent = await TempStudent.findOne({ 
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : null }, 
                            { studentID: studentId.toUpperCase() }
                        ]
                    });

                    if (foundStudent) {
                        student = foundStudent;
                        Student = TempStudent;
                        usedCollection = collectionName;
                        console.log(`🎯 Found student in ${collectionName}`);
                        break;
                    }
                } catch (err) {
                    console.warn(`⚠️ Error searching in ${streamConfig.name} sem ${sem}:`, err.message);
                    continue;
                }
            }
            if (student) break;
        }

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found in any collection",
                searchedCollections: searchedCollections.length,
                studentId: studentId
            });
        }

        // Sanitize string fields
        if (updates.name) updates.name = updates.name.trim();
        if (updates.parentPhone) updates.parentPhone = updates.parentPhone.trim();
        if (updates.studentID) updates.studentID = updates.studentID.toUpperCase().trim();

        // Update the student with validation
        const updatedStudent = await Student.findByIdAndUpdate(
            student._id,
            { 
                $set: {
                    ...updates,
                    updatedAt: new Date()
                }
            },
            { 
                new: true, 
                runValidators: true,
                context: 'query' // Ensures validators run properly
            }
        );

        console.log(`✅ Student updated successfully: ${updatedStudent.studentID}`);

        res.json({
            success: true,
            message: "Student updated successfully",
            student: updatedStudent,
            collectionUsed: usedCollection,
            updatedFields: Object.keys(updates)
        });

    } catch (error) {
        console.error('❌ Error updating student:', error);

        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                errors: Object.keys(error.errors).map(key => ({
                    field: key,
                    message: error.errors[key].message
                }))
            });
        }

        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: "Duplicate value error",
                error: "A student with this ID already exists"
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to update student",
            error: error.message
        });
    }
}));

// DELETE STUDENT - ENHANCED WITH LOGGING
router.delete('/students/:studentId', asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    console.log(`🗑️ Deleting student: ${studentId}`);

    try {
        let student = null;
        let Student = null;
        let usedCollection = null;

        // Find student across all collections
        for (const streamConfig of STREAMS_CONFIG) {
            for (const sem of streamConfig.semesters) {
                try {
                    const TempStudent = getStudentModel(streamConfig.name, sem);
                    const foundStudent = await TempStudent.findOne({ 
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : null }, 
                            { studentID: studentId.toUpperCase() }
                        ]
                    });
                    if (foundStudent) {
                        student = foundStudent;
                        Student = TempStudent;
                        usedCollection = getCollectionName(streamConfig.name, sem, 'students');
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }
            if (student) break;
        }

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found in any collection"
            });
        }

        // Store student info before deletion
        const deletedStudentInfo = {
            studentID: student.studentID,
            name: student.name,
            stream: student.stream,
            semester: student.semester,
            collection: usedCollection
        };

        await Student.findByIdAndDelete(student._id);

        console.log(`✅ Student deleted successfully: ${deletedStudentInfo.studentID} from ${usedCollection}`);

        res.json({
            success: true,
            message: `Student "${student.name}" deleted successfully`,
            deleted: deletedStudentInfo
        });

    } catch (error) {
        console.error('❌ Error deleting student:', error);
        res.status(500).json({
            success: false,
            message: "Failed to delete student",
            error: error.message
        });
    }
}));

// GET STUDENT BY ID - ENHANCED WITH METADATA
router.get('/students/find/:studentId', asyncHandler(async (req, res) => {
    const { studentId } = req.params;

    console.log(`🔍 Finding student: ${studentId}`);

    try {
        let student = null;
        let usedCollection = null;
        let searchedCollections = [];

        for (const streamConfig of STREAMS_CONFIG) {
            for (const sem of streamConfig.semesters) {
                try {
                    const Student = getStudentModel(streamConfig.name, sem);
                    const collectionName = getCollectionName(streamConfig.name, sem, 'students');
                    searchedCollections.push(collectionName);

                    const foundStudent = await Student.findOne({ 
                        $or: [
                            { _id: mongoose.Types.ObjectId.isValid(studentId) ? studentId : null }, 
                            { studentID: studentId.toUpperCase() }
                        ]
                    });
                    if (foundStudent) {
                        student = foundStudent;
                        usedCollection = collectionName;
                        break;
                    }
                } catch (err) {
                    continue;
                }
            }
            if (student) break;
        }

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found",
                searchedCollections: searchedCollections.length
            });
        }

        console.log(`✅ Student found: ${student.studentID} in ${usedCollection}`);

        res.json({
            success: true,
            student: {
                ...student.toObject(),
                _collection: usedCollection
            },
            foundInCollection: usedCollection,
            searchedCollections: searchedCollections.length
        });

    } catch (error) {
        console.error('❌ Error finding student:', error);
        res.status(500).json({
            success: false,
            message: "Failed to find student",
            error: error.message
        });
    }
}));

// ===== SUBJECT ROUTES ===== (Keep existing functionality)

// CREATE SUBJECT
router.post('/subjects/:stream/sem:sem', validateParams, asyncHandler(async (req, res) => {
    const { stream, sem } = req.params;
    const { 
        subjectName, 
        subjectCode,
        subjectType, 
        credits, 
        isLanguageSubject, 
        languageType, 
        description,
        isActive 
    } = req.body;

    try {
        if (!subjectName) {
            return res.status(400).json({
                success: false,
                message: "Subject name is required"
            });
        }

        const Subject = getSubjectModel(stream, sem);
        const collectionName = getCollectionName(stream, sem, 'subjects');

        const existingSubject = await Subject.findOne({ 
            subjectName: subjectName.toUpperCase() 
        });

        if (existingSubject) {
            return res.status(409).json({
                success: false,
                message: `Subject "${subjectName}" already exists in ${collectionName}`
            });
        }

        const subjectData = {
            subjectName: subjectName.toUpperCase().trim(),
            subjectCode: subjectCode || `${stream.replace(/\s+/g, '')}${sem}${subjectName.substring(0,3).toUpperCase()}`,
            stream: stream,
            semester: parseInt(sem),
            subjectType: subjectType || 'CORE',
            credits: parseInt(credits) || 4,
            isLanguageSubject: isLanguageSubject || subjectType === 'LANGUAGE',
            languageType: (isLanguageSubject || subjectType === 'LANGUAGE') ? languageType : null,
            description: description || `${subjectName} for ${stream} ${sem} Semester`,
            isActive: isActive !== false
        };

        const newSubject = new Subject(subjectData);
        await newSubject.save();

        res.status(201).json({
            success: true,
            message: `Subject "${subjectName}" created successfully`,
            subject: newSubject,
            collectionUsed: collectionName
        });

    } catch (error) {
        console.error('Error creating subject:', error);
        res.status(500).json({
            success: false,
            message: "Failed to create subject",
            error: error.message
        });
    }
}));

// GET ALL SUBJECTS
router.get('/subjects/all', asyncHandler(async (req, res) => {
    try {
        const { 
            stream, 
            semester, 
            isActive = 'true', 
            subjectType,
            search = ''
        } = req.query;

        const allSubjects = [];
        let collectionsScanned = [];
        let collectionsWithData = [];

        const streamsToSearch = stream ? 
            STREAMS_CONFIG.filter(s => s.name === stream) : 
            STREAMS_CONFIG;

        const semestersToSearch = semester ? [parseInt(semester)] : [1,2,3,4,5,6];

        for (const streamConfig of streamsToSearch) {
            for (const sem of semestersToSearch) {
                if (!streamConfig.semesters.includes(sem)) continue;

                try {
                    const Subject = getSubjectModel(streamConfig.name, sem);
                    const collectionName = getCollectionName(streamConfig.name, sem, 'subjects');
                    collectionsScanned.push(collectionName);

                    let query = {};
                    if (isActive !== 'all') {
                        query.isActive = isActive === 'true';
                    }
                    if (subjectType) {
                        if (subjectType === 'LANGUAGE') {
                            query.isLanguageSubject = true;
                        } else {
                            query.subjectType = subjectType.toUpperCase();
                        }
                    }
                    if (search) {
                        query.$or = [
                            { subjectName: new RegExp(search, 'i') },
                            { subjectCode: new RegExp(search, 'i') }
                        ];
                    }

                    const subjects = await Subject.find(query)
                        .sort({ subjectName: 1 })
                        .lean();

                    if (subjects.length > 0) {
                        collectionsWithData.push({
                            collection: collectionName,
                            count: subjects.length,
                            stream: streamConfig.name,
                            semester: sem
                        });
                    }

                    const subjectsWithMetadata = subjects.map(subject => ({
                        ...subject,
                        _collection: collectionName,
                        _streamMapping: streamConfig.collectionPrefix
                    }));

                    allSubjects.push(...subjectsWithMetadata);
                } catch (err) {
                    console.warn(`Failed to fetch subjects from ${streamConfig.name} sem ${sem}:`, err.message);
                    continue;
                }
            }
        }

        res.json({
            success: true,
            count: allSubjects.length,
            subjects: allSubjects,
            metadata: {
                collectionsScanned: collectionsScanned,
                collectionsWithData: collectionsWithData,
                streamMappings: STREAM_COLLECTION_MAP
            }
        });

    } catch (error) {
        console.error('Error loading subjects:', error);
        res.status(500).json({
            success: false,
            message: "Failed to load subjects",
            error: error.message
        });
    }
}));

// ===== UTILITY ROUTES =====

// Statistics endpoint - ENHANCED
router.get('/stats', asyncHandler(async (req, res) => {
    console.log('📊 Generating statistics...');

    try {
        const stats = {
            students: { total: 0, byStream: {}, bySemester: {} },
            subjects: { total: 0, byStream: {}, bySemester: {} },
            collectionsInfo: [],
            streamMappings: STREAM_COLLECTION_MAP,
            performance: {
                startTime: Date.now(),
                collectionsProcessed: 0,
                errors: []
            }
        };

        for (const streamConfig of STREAMS_CONFIG) {
            stats.students.byStream[streamConfig.name] = 0;
            stats.subjects.byStream[streamConfig.name] = 0;

            for (const sem of streamConfig.semesters) {
                stats.performance.collectionsProcessed++;

                try {
                    const Student = getStudentModel(streamConfig.name, sem);
                    const Subject = getSubjectModel(streamConfig.name, sem);

                    // Use Promise.all for parallel execution
                    const [studentCount, subjectCount] = await Promise.all([
                        Student.countDocuments({ isActive: true }),
                        Subject.countDocuments({ isActive: true })
                    ]);

                    stats.students.total += studentCount;
                    stats.subjects.total += subjectCount;
                    stats.students.byStream[streamConfig.name] += studentCount;
                    stats.subjects.byStream[streamConfig.name] += subjectCount;

                    const semKey = `sem${sem}`;
                    stats.students.bySemester[semKey] = (stats.students.bySemester[semKey] || 0) + studentCount;
                    stats.subjects.bySemester[semKey] = (stats.subjects.bySemester[semKey] || 0) + subjectCount;

                    if (studentCount > 0 || subjectCount > 0) {
                        stats.collectionsInfo.push({
                            stream: streamConfig.name,
                            streamMapping: streamConfig.collectionPrefix,
                            semester: sem,
                            studentCollection: getCollectionName(streamConfig.name, sem, 'students'),
                            subjectCollection: getCollectionName(streamConfig.name, sem, 'subjects'),
                            studentCount,
                            subjectCount
                        });
                    }

                } catch (err) {
                    stats.performance.errors.push({
                        stream: streamConfig.name,
                        semester: sem,
                        error: err.message
                    });
                    continue;
                }
            }
        }

        stats.performance.endTime = Date.now();
        stats.performance.duration = stats.performance.endTime - stats.performance.startTime;

        console.log(`✅ Stats generated in ${stats.performance.duration}ms - ${stats.students.total} students, ${stats.subjects.total} subjects`);

        res.json({
            success: true,
            stats: stats,
            streamConfiguration: STREAMS_CONFIG,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ Error getting stats:', error);
        res.status(500).json({
            success: false,
            message: "Failed to get statistics",
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}));

// Get streams configuration
router.get('/config/streams', (req, res) => {
    res.json({
        success: true,
        streams: STREAMS_CONFIG,
        streamMappings: STREAM_COLLECTION_MAP,
        collectionTemplate: '{prefix}_sem{number}_{students|subjects}',
        examples: Object.entries(STREAM_COLLECTION_MAP).reduce((acc, [name, prefix]) => {
            acc[name] = {
                students: `${prefix}_sem1_students`,
                subjects: `${prefix}_sem1_subjects`
            };
            return acc;
        }, {}),
        timestamp: new Date().toISOString()
    });
});

// Health check - ENHANCED
router.get('/health', (req, res) => {
    const health = {
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        streamCount: STREAMS_CONFIG.length,
        totalPossibleCollections: STREAMS_CONFIG.reduce((sum, s) => sum + (s.semesters.length * 2), 0),
        modelCacheSize: modelCache.size,
        streamMappings: STREAM_COLLECTION_MAP,
        mongodb: {
            connected: mongoose.connection.readyState === 1,
            readyState: mongoose.connection.readyState,
            name: mongoose.connection.name
        },
        system: {
            nodeVersion: process.version,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        }
    };

    // Set appropriate status code based on MongoDB connection
    const statusCode = health.mongodb.connected ? 200 : 503;

    res.status(statusCode).json(health);
});

// ===== MIDDLEWARE =====

// Validation middleware
function validateParams(req, res, next) {
    const { stream, sem } = req.params;

    if (!STREAM_COLLECTION_MAP[stream]) {
        return res.status(400).json({
            success: false,
            message: `Invalid stream: ${stream}`,
            validStreams: Object.keys(STREAM_COLLECTION_MAP)
        });
    }

    const validation = validateStreamAndSemester(stream, sem);
    if (!validation.valid) {
        return res.status(400).json({
            success: false,
            message: validation.error
        });
    }

    next();
}

// Error handling middleware
router.use((error, req, res, next) => {
    console.error('🚨 Route Error:', error);

    // Don't send error details in production
    const isDevelopment = process.env.NODE_ENV !== 'production';

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: isDevelopment ? error.message : 'An error occurred',
        timestamp: new Date().toISOString()
    });
});

console.log(`🚀 UpdateRoute loaded successfully!`);
console.log(`📋 Configuration: ${STREAMS_CONFIG.length} streams, ${Object.keys(STREAM_COLLECTION_MAP).length} collection mappings`);
console.log(`🗂️ Collections: ${STREAMS_CONFIG.reduce((sum, s) => sum + (s.semesters.length * 2), 0)} total possible collections`);

module.exports = router;
