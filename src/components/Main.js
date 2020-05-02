import React from "react";

export default Main => {
  return (
    <>
      <h1>
        Hey, I'm Abi. I'm currently living in Paris as full stack developer at <a href="https://govirtuo.com">virtuo</a>.
      </h1>
      <h3>Contact me!</h3>

      <div >
        <ul className="contact">
          <li><a href="https://twitter.com/abijsummers">Twitter</a></li>
          <li> <a href="https://github.com/abisummers">Github</a></li>
          <li> <a href="https://www.linkedin.com/in/abisummers/">Linkedin</a></li>
        </ul>
      </div>


      <h3>Experience</h3>

      <div className="background-box">
        <h4>Virtuo</h4>
        <p>I'm currently a full stack deleloper at virtuo using node and react. Responsibilites include analysing and identifying bug, modifiying internal tools, documentation and improving the customer experience.</p>
      </div>


      <div className="background-box">
        <h4>Web Dev teaching assistant</h4>
        <p>I spent 10 months working at Ironhack Paris as a teaching assistant. During this time I helped over 50 students learn to code from the very basics. We covered HTML, CSS, node, express, mongoDB and React.</p>
        <p>At the end of the 9 week bootcamp, most students were able to find a full time position working as a developer</p>
      </div>



      <h3>Workshops</h3>

      <div className="background-box">
        <h4>Intro to web development</h4>
        <p>At Virtuo, I was able to give an internal talk about the basics of web development. We covered the basics of what the web is, why we create websites and what do we mean by web development. I also explained what HTML and CSS are and gave a short demo to explain what they do in relation to each other</p>
        <p>I created the slides using mdx-deck and hosted the site on netlify which can be found  <a href="https://virtuo-webinar.netlify.app">here</a></p>
      </div>

      <div className="background-box">
        <h4>Build ping pong using canvas</h4>
        <p>During a two evening workshop (4 hours in total), I helped 20 people build a version of ping pong using canvas. Most of the people who attended the workshop has never coded before.</p>
      </div>

      <div className="background-box">
        <h4>Code me if you can</h4>
        <p>While a TA at Ironhack, I did some short workshops in the evening for potential students, or those interested in learning how to code</p>
        <p>The first workshop was a basic HTML and css site, hosted on github pages which can be found <a href="https://abisummers.com/code-me-if-you-can/">here</a>.</p>

        <p>The second workshop was similar to the first with the main difference being the styling. I was asked to put together a 'blog' like template for people interested in creating a blog. <a href="https://abisummers.com/code-me-blog/">here</a>.</p>
      </div>




    </>
  );
};

