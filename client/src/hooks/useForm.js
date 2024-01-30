import { useState } from "react";
// import useStateCB from "./useStateCB";

const useForm = (valuesObject, submit) => {
  const [values, setValues] = useState({
    ...valuesObject,
  });
  const [message, setMessage] = useState({ error: "", success: "" });

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prevProps) => ({
      ...prevProps,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(values, setMessage);
  };

  const handleReset = (event) => {
    event.preventDefault();
    setValues({
      ...valuesObject,
    });
    setMessage({ error: "", success: "" });
  };

  return {
    handleChange,
    handleSubmit,
    handleReset,
    message,
    values,
  };
};

export default useForm;
