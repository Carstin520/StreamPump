import type { GetServerSideProps } from "next";

const PostsIndexPage = () => null;

export const getServerSideProps: GetServerSideProps = async () => ({
  redirect: {
    destination: "/explore",
    permanent: false,
  },
});

export default PostsIndexPage;
