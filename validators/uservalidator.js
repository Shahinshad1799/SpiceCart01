const { z } = require("zod");

const editProfileSchema = z.object({
  fullname: z
    .string()
    .min(3, "Full name must be at least 3 characters")
    .regex(/^[A-Za-z ]+$/, "Only letters allowed"),

  phonenumber: z
    .string()
    .regex(/^[0-9]{10}$/, "Phone must be 10 digits"),

  dateofbirth: z
    .string()
    .refine((date) => {
      const birth = new Date(date);
      const today = new Date();

      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();

      if (
        monthDiff < 0 ||
        (monthDiff === 0 && today.getDate() < birth.getDate())
      ) {
        age--;
      }

      return age >= 18;
    }, "You must be at least 18 years old"),
});

module.exports = { editProfileSchema };