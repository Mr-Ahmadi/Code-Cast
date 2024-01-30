import axios from "axios";
import checkEmail from "../validation/checkEmail";
import checkPassword from "../validation/checkPassword";

const signUp = async (values, setMessage) => {
  // setRequesting(true);
  if (checkEmail(values.email)) {
    setMessage({ success: "", error: checkEmail(values.email) });
  } else if (checkPassword(values.password)) {
    setMessage({ success: "", error: checkPassword(values.password) });
  } else if (!values.repeatPassword) {
    setMessage({ success: "", error: "Please repeat your password" });
  } else if (values.repeatPassword !== values.password) {
    setMessage({ success: "", error: "Passwords do not match" });
  } else {
    let data = JSON.stringify({
      email: values.email,
      password: values.password,
    });

    let config = {
      method: "post",
      url: "http://localhost:4000/user/signup",
      headers: {
        "Content-Type": "application/json",
      },
      data,
    };

    axios
      .request(config)
      .then(({ data: { message }, status }) => {
        if (status === 201) {
          // setRequesting(false);
          console.log(message);
          setMessage({ error: "", success: "done!" });
        } else {
          // setRequesting(false);
          console.log(message);
          setMessage({ error: message, success: "" });
        }
      })
      .catch((err) => {
        // setRequesting(false);
        console.log(err.message);
        setMessage({ error: err.message, success: "" });
      });
  }
};

export default signUp;
