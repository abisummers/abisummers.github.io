interface BookeoProductsResponse {
  data: BookeoProduct[];
  info: {
    page: number;
    pageSize: number;
    totalEntries: number;
    totalPages: number;
  };
}

export type BookeoProduct = {
  /**
   * The title of the guide
   */
  name: string;
  /**
   * HTML description
   */
  description: string;
  /**
   * The unique identifier of the product (used in the booking widget)
   * e.g. "3252MKCWA4193B1401C92"
   */
  productId: string;
  /**
   * The unique slug of the product (used in the URL)
   * e.g. "visit-paris"
   */
  productCode: string;
  /**
   * Images associated with the product
   */
  images: {
    url: string;
  }[];
  /**
   * Duration of the product
   */
  duration: {
    days: number;
    hours: number;
    minutes: number;
  };
};

export async function getProducts(): Promise<BookeoProductsResponse> {
  const { data, info } = (await fetch(
    `https://api.bookeo.com/v2/settings/products?apiKey=${import.meta.env.BOOKEO_CLIENT}&secretKey=${import.meta.env.BOOKEO_SERVER}`,
  ).then((res) => res.json())) as BookeoProductsResponse;

  return { data, info };
}
