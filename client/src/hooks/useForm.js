import { useState } from "react";

const useForm = (valuesObject, validate) => {
  const [values, setValues] = useState({
    ...valuesObject,
  });
  const [errors, setErrors] = useState({});

  const handleChange = (event) => {
    const { name, value } = event.target;
    setValues((prevProps) => ({
      ...prevProps,
      [name]: value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setErrors(validate(values));
  };

  const handleReset = (event) => {
    event.preventDefault();
    setValues({
      ...valuesObject,
    });
    setErrors({});
  };

  return { handleChange, handleSubmit, handleReset, values, errors };
};

export default useForm;
