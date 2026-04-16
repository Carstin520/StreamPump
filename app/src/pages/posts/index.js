"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
const PostsIndexPage = () => null;
const getServerSideProps = async () => ({
    redirect: {
        destination: "/explore",
        permanent: false,
    },
});
exports.getServerSideProps = getServerSideProps;
exports.default = PostsIndexPage;
