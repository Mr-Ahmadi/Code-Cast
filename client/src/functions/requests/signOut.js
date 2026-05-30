import cookies from "js-cookie";

const signOut = async (navigate) => {
  cookies.remove("jwt");
  navigate("/signin");
};

export default signOut;
