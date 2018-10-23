import React, { Component } from "react";
import Projects from "./components/Project-list";

class App extends Component {
  render() {
    return (
      <>
        <h1>
          Hey there, I'm learning to code{" "}
          <span role="img" aria-label="smiley angel">
            😇
          </span>
        </h1>
        <img src="profile-picture.jpg" alt="Me!" />
        <p>
          Web Dev student at <a href="https://www.ironhack.com/en">Ironhack</a>,
          Paris
        </p>
        <Projects />
        <p>
          You can follow me on
          <a href="https://github.com/abisummers">GitHub</a> or
          <a href="https://twitter.com/abijsummers">Twitter</a>
        </p>
      </>
    );
  }
}

export default App;
