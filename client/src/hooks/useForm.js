import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const useForm = (valuesObject, submit) => {
  const [values, setValues] = useState({
    ...valuesObject,
  });

  const navigate = useNavigate();
  const location = useLocation();

  const [message, setMessage] = useState(
    location.state && location.state.message
      ? location.state.message
      : [null, null]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prevProps) => ({
      ...prevProps,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    submit(values, setMessage, navigate);
  };

  const handleReset = (event) => {
    event.preventDefault();
    setValues({
      ...valuesObject,
    });
    setMessage([null, null]);
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
