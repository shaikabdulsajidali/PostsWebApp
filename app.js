const express=require('express')
const app=express()

const userModel=require('./models/user')
const postModel=require('./models/posts')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const path=require('path')

const upload = require('./config/multerconfig')

app.set('view engine','ejs')
app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(express.static(path.join(__dirname,'public')))
app.use(cookieParser())

app.get("/",(req,res)=>{
    res.render("index")
})

app.post("/register",async (req,res)=>{

    let {username,name,age,email,password}=req.body;

    let user= await userModel.findOne({email});
    if(user) return res.status(500).send("User already exists!")

    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async (err,hash)=>{
            let user = await userModel.create({
                username,
                name,
                age,
                email,
                password: hash
            })

            const token = jwt.sign({email: email, userid: user._id},"secretkey",{expiresIn:'1hr'})
            res.cookie("token",token)
            console.log("new user registered!!")
            res.redirect("/login")
            // res.send("registered!")

        })
    })

})

app.get("/profileupload",isLoggedIn,(req,res)=>{
    res.render("profileupload");
})

app.post("/picupload",isLoggedIn,upload.single("image"), async (req,res)=>{
    let user= await userModel.findOne({email:req.user.email})
    // console.log(req.file)
    user.profilepic = req.file.filename;
    await user.save()
    res.redirect("/profile");
})

app.get("/login",(req,res)=>{
    res.render("login")
})

app.post("/login",async (req,res)=>{

    let {email,password}=req.body;
    let user= await userModel.findOne({email});
    if(!user) return res.status(500).send("User does not exists!")

    bcrypt.compare(password,user.password,(err,result)=>{
        if(result) {
            const token = jwt.sign({email: email, userid: user._id},"secretkey",{expiresIn:'1hr'})
            res.cookie("token",token)
            // console.log({token})
            console.log("token created")
            return res.status(200).redirect('/profile')
        }  
        else return res.status(500).redirect('/login')
        // else return res.status(500).send("something went wrong..")
    });  
})

app.get("/logout",(req,res)=>{
    res.cookie("token","")
    console.log("logged out!!")
    res.redirect("/login")
})

app.get("/profile",isLoggedIn,async (req,res)=>{
    let user=await userModel.findOne({email: req.user.email}).populate("posts")
    // console.log(user)
    res.render("profile",{user})
})

app.post("/post",isLoggedIn,async (req,res)=>{
    let user=await userModel.findOne({email: req.user.email})    //req.user is the user data retrived from jwt token
    let post= await postModel.create({
        user:user._id,                                           // user id assign
        content:req.body.content                                 // content from url body
    })                   
    user.posts.push(post._id)                                    //pushing id of post to user's (posts array) for referencing the post in user profile
    await user.save()
    res.redirect("/profile")
})


app.get("/like/:id",isLoggedIn,async (req,res)=>{
    let post=await postModel.findOne({_id:req.params.id}).populate("user")   //populate is used  to get user data in place of id 
    // console.log(post)

    if(post.likes.indexOf(req.user.userid) === -1){
        post.likes.push(req.user.userid)                                        //storing userid to count user likes  
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1);             //removing the userid from posts
    }

    await post.save();                                        //as we done push we should save(wait until it completes so await )
    res.redirect("/profile")
})

app.get("/edit/:id",isLoggedIn,async (req,res)=>{
    let post=await postModel.findOne({_id:req.params.id}).populate("user")   //populate is used  to get user data in place of id 
    // console.log(post)
    
    res.render("edit",{post})
})

app.post("/update/:id",isLoggedIn,async (req,res)=>{
    let post= await postModel.findOneAndUpdate({_id:req.params.id},{content:req.body.content})
    // console.log(post) 
   
    res.redirect("/profile")
})

function isLoggedIn(req,res,next){                      //middleware for checking the user is log in or not
    if(req.cookies.token==""){
        console.log("you must be logged in first! ");
        res.redirect("/login")
    }
    else{
        let data=jwt.verify(req.cookies.token,"secretkey")
        req.user=data
        next();
    }
}

app.listen(3000,()=>{
    console.log("server listening...")
})