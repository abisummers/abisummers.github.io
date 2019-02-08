import React, { Component } from "react";

class Main extends Component {
  state = {};
  render() {
    return (
      <>
        <h1>
          Hey there, I'm learning to code
          <span role="img" aria-label="smiley angel">
            😇
          </span>
        </h1>
        <img src="profile-picture.png" alt="Me!" />
        <p>
          Web Dev Teaching Assistant
          <a href="https://www.ironhack.com/en">Ironhack</a>, Paris
        </p>
      </>
    );
  }
}

export default Main;
