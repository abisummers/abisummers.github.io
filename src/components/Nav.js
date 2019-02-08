import React from "react";
import { NavLink } from "react-router-dom";

export default Nav => {
  return (
    <div>
      <nav>
        <NavLink exact to="/">
          Home
        </NavLink>
        <NavLink to="/about">About Me</NavLink>

        <NavLink to="/projects">Projects</NavLink>
      </nav>
    </div>
  );
};
