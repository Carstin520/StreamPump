"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
exports.default = HomePage;
const getServerSideProps = async () => ({
    redirect: {
        destination: "/explore",
        permanent: false,
    },
});
exports.getServerSideProps = getServerSideProps;
function HomePage() {
    return null;
}
