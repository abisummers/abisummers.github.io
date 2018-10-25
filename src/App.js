import React, { Component } from "react";
import Nav from "./components/Nav";

import Main from "./components/Main";

class App extends Component {
  render() {
    return (
      <>
        <Nav />
        <Main />
        <p>
          You can follow me on{" "}
          <a href="https://github.com/abisummers">GitHub</a> or{" "}
          <a href="https://twitter.com/abijsummers">Twitter</a>
        </p>
      </>
    );
  }
}

export default App;
