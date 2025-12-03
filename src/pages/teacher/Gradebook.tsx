import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Gradebook = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Redirect to the new Grades page
    navigate("/teacher/grades", { replace: true });
  }, [navigate]);

  return null;
};

export default Gradebook;
