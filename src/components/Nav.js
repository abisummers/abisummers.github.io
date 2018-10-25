import React, { Component } from "react";
import { NavLink, Route } from "react-router-dom";
import About from "./About";
import Projects from "./Project-list";

class Nav extends Component {
  state = {};
  render() {
    return (
      <>
        <nav>
          <NavLink to="/">Home</NavLink>
          <NavLink to="/about">About Me</NavLink>

          <NavLink to="/projects">Projects</NavLink>
        </nav>

        <Route exact path="/" />
        <Route path="/projects" component={Projects} />
        <Route path="/about" component={About} />
      </>
    );
  }
}

export default Nav;
