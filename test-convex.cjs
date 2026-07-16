import { ConvexReactClient } from "convex/react";
import { ConvexProviderWithAuth } from "convex/react";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement, useEffect, useState } from "react";

// Mock client
const client = new ConvexReactClient("https://sincere-clownfish-686.convex.cloud", { expectAuth: true });

function Test() {
  const [auth, setAuth] = useState({ isLoading: true, isAuthenticated: true, fetchAccessToken: async () => null });
  
  useEffect(() => {
    setTimeout(() => {
      console.log("Setting isAuthenticated to false...");
      setAuth({ isLoading: false, isAuthenticated: false, fetchAccessToken: async () => null });
    }, 1000);
  }, []);

  return createElement(ConvexProviderWithAuth, { client, useAuth: () => auth }, "Hello");
}

console.log("Test script ready.");
