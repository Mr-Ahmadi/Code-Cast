import axios from "axios";

const newLink = async (setMessage) => {
  setMessage(["LOADING", null]);

  let config = {
    method: "get",
    url: "user/newlink",
    // headers: {
    //   "Content-Type": "application/json",
    // },
    withCredentials: true,
  };

  axios
    .request(config)
    .then(({ data: { message }, status }) => {
      if (status === 200) {
        setMessage(["SUCCESS", message]);
      } else {
        setMessage(["ERROR", message]);
      }
    })
    .catch((err) => {
      setMessage(["ERROR", err.message]);
    });
};

export default newLink;
