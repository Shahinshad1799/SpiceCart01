const { z } = require("zod");

const variantSchema = z.object({
  name: z.string().min(1, "Variant name required"),
  price: z.coerce.number().min(1, "Price must be > 0"),
  stock: z.coerce.number().min(0, "Stock cannot be negative")
});

const productSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().min(5, "Description too short"),
  catagory: z.string().min(1, "Category required"),
  variants: z.array(variantSchema).min(1, "At least one variant required")
});

module.exports = { productSchema };