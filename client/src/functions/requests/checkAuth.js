import axios from "axios";
import cookies from "js-cookie";

const checkAuth = async (setAuth) => {
  if (cookies.get("jwt")) {
    let config = {
      method: "post",
      url: "http://localhost:4000/user/signin",
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ status }) => {
        if (status === 200) {
          setAuth(true);
        } else {
          setAuth(false);
        }
      })
      .catch(() => {
        setAuth(undefined);
      });
  } else setAuth(false);
};

export default checkAuth;
