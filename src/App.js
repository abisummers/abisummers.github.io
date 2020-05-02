import React, { Component } from "react";

import Main from "./components/Main";

class App extends Component {
  render() {
    return (
      <>
        <Main />
        <p>
          You can follow me on{" "}
          <a target="_" href="https://github.com/abisummers">
            GitHub
          </a>{" "}
          or{" "}
          <a target="_" href="https://twitter.com/abijsummers">
            Twitter
          </a>
        </p>

      </>
    );
  }
}

export default App;
