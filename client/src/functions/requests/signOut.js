import cookies from "js-cookie";

const signOut = async (checkAuth, navigate) => {
  cookies.remove("jwt");
  checkAuth();
  navigate("/signin");
};

export default signOut;
