import React, { Component } from "react";

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
        <p>Some of the projects I've made:</p>
        <ul>
          <li>
            <a href="https://ironhack-sharer.herokuapp.com/">Ironhack Sharer</a>
          </li>
          <li>
            <a href="https://abisummers.com/Project-One/">
              Tap Tap Revolution!
            </a>
          </li>
          <li>
            <a href="https://abisummers.com/lab-css-spotify-clone/starter-code/">
              Spotify landing page clone
            </a>
          </li>
          <li>
            <a href="https://abisummers.com/todo-list/solution/">Todo list</a>
          </li>
          <li>
            <a href="https://abisummers.com/lab-css-instagram-clone/starter-code/">
              Instagram landing page clone
            </a>
          </li>
          <li>
            <a href="https://abisummers.com/mars-rover/">Mars Rover</a>
          </li>
        </ul>
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
