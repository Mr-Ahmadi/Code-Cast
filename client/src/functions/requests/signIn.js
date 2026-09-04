import axios from "axios";
import checkEmail from "../validation/checkEmail";
import checkPassword from "../validation/checkPassword";
import { setAuthToken } from "../../services/serverConfig";
import describeRequestError from "./describeRequestError";

const signIn = async (values, setMessage, navigate) => {
  setMessage(["LOADING", null]);

  if (checkEmail(values.email)) {
    setMessage(["ERROR", checkEmail(values.email)]);
  } else if (checkPassword(values.password)) {
    setMessage(["ERROR", checkPassword(values.password)]);
  } else {
    let data = JSON.stringify({
      email: values.email,
      password: values.password,
    });

    let config = {
      method: "post",
      url: "user/signin",
      headers: {
        "Content-Type": "application/json",
      },
      data,
      withCredentials: true,
    };

    axios
      .request(config)
      .then(({ data: { message, token }, status }) => {
        if (status === 200) {
          // Held client-side so a remote endpoint, whose cookie this origin
          // cannot read, still authenticates.
          if (token) setAuthToken(token);
          navigate("/", { state: { message: ["SUCCESS", message] } });
        } else {
          setMessage(["ERROR", message]);
        }
      })
      .catch((err) => {
        setMessage(["ERROR", describeRequestError(err)]);
      });
  }
};

export default signIn;
