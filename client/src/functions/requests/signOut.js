import cookies from "js-cookie";
import { clearAuthToken } from "../../services/serverConfig";

const signOut = async (navigate) => {
  cookies.remove("jwt");
  clearAuthToken();
  navigate("/signin");
};

export default signOut;
