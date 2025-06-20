require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

const logger = (req, res, next) => {
    console.log('inside the logger');
    next();
}

const verifyToken = (req, res, next) => {
    const token = req.cookies.token;
    if(!token){
        return res.status(401).send({message: 'unAuthorized access'});
    }

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if(err){
            return res.status(401).send({message: 'unAuthorized access'});
        }
        req.user = decoded;
        next();
    })
}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuac6m8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        await client.db("admin").command({ ping: 1 });
        console.log("connected to MongoDB!");

        // jobs related collections
        const jobsCollections = client.db('jobPortal').collection('jobs');
        const jobApplication = client.db('jobPortal').collection('job_applications');

        // auth related APIs
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1h'});
            res
            .cookie('token', token, {
                httpOnly: true,
                secure: false,
            })
            .send({success: true});
        })

        // job related apis
        app.get('/jobs', logger, async (req, res) => {
            console.log('now inside the api callback');
            const email = req.query.email;
            let query = {}
            if (email) {
                query = { hr_email: email }
            }
            const cursor = jobsCollections.find(query);
            const result = await cursor.toArray();
            res.send(result);
        })
        app.get('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollections.findOne(query);
            res.send(result);
        })
        app.post('/jobs', async (req, res) => {
            const body = req.body;
            const result = await jobsCollections.insertOne(body);
            res.send(result);
        })
        app.delete('/jobs/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobsCollections.deleteOne(query);
            res.send(result);
        })

        // job applications apis
        app.get('/job-application', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { applicant_email: email };

            if(req.user?.email !== req.query.email){
                return res.status(403).send({message: 'forbidden access'});
            }

            const result = await jobApplication.find(query).toArray();

            // fokira way aggreget
            for (const application of result) {
                const query1 = { _id: new ObjectId(application.job_id) };
                const job = await jobsCollections.findOne(query1)
                if (job) {
                    application.title = job.title
                    application.company = job.company
                    application.jobType = job.jobType
                    application.company_logo = job.company_logo
                    application.location = job.location
                }
            }
            res.send(result);
        })
        app.get('/job-applications/jobs/:job_id', async (req, res) => {
            const jobId = req.params.job_id;
            const query = { job_id: jobId };
            const result = await jobApplication.find(query).toArray();
            res.send(result);
        })
        app.post('/job-applications', async (req, res) => {
            const application = req.body;
            const result = await jobApplication.insertOne(application);

            // not the best way {aggreget}

            const id = application.job_id;
            const query = { _id: new ObjectId(id) };
            const job = await jobsCollections.findOne(query);
            let newCount = 0;
            if (job.applicationCount) {
                newCount = job.applicationCount + 1;
            }
            else {
                newCount = 1;
            }

            // now update the job info
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    applicationCount: newCount
                }
            }

            const updatedResult = await jobsCollections.updateOne(filter, updatedDoc)

            res.send(result);
        })
        app.delete('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await jobApplication.deleteOne(query);
            res.send(result);
        })
        app.patch('/job-applications/:id', async (req, res) => {
            const id = req.params.id;
            const body = req.body;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: body.status
                }
            }
            const result = await jobApplication.updateOne(filter, updatedDoc);
            res.send(result);
        })
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('job is falling in the sky');
})
app.listen(port, () => {
    console.log(`server is running on por: ${port}`);
})